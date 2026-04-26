from __future__ import annotations

import json
import os
import signal
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import paho.mqtt.client as mqtt
import requests
import structlog

from config import AgentConfig, load_config
from edid import EDIDReader
from logging_utils import configure_logging
from pop_logger import PoPLogger
from power import PowerManager
from sync import SyncClient


class EdgeAgent:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.log = structlog.get_logger("agent").bind(device_id=config.device_id)
        self.stop_event = threading.Event()
        self.current_campaigns: dict[str, str] = {"A": "", "B": "", "C": ""}
        self.sync_client = SyncClient(config)
        self.edid_reader = EDIDReader(config)
        self.pop_logger = PoPLogger(config.device_id, str(config.api_url))
        self.power_manager = PowerManager(
            config=config,
            pop_logger=self.pop_logger,
            ignition_reader=self._read_acc_signal,
            voltage_reader=self._read_voltage,
            on_finish_current_asset=self._signal_player_finish_asset,
        )
        self.mqtt_client = self._build_mqtt_client()

    def start(self) -> None:
        signal.signal(signal.SIGTERM, self._handle_sigterm)
        signal.signal(signal.SIGINT, self._handle_sigterm)
        self.log.info("agent_starting")

        self._bootstrap_local_state()
        self._start_background_loops()
        self._connect_mqtt()

        while not self.stop_event.is_set():
            self.power_manager.monitor_once()
            time.sleep(2)
        self.shutdown()

    def shutdown(self) -> None:
        self.log.info("agent_shutdown_started")
        self.stop_event.set()
        self.pop_logger.upload_pending()
        self.mqtt_client.loop_stop()
        self.mqtt_client.disconnect()
        self.log.info("agent_shutdown_complete")

    def _bootstrap_local_state(self) -> None:
        try:
            schedule = self.sync_client.fetch_schedule()
            downloaded = self.sync_client.sync_assets(schedule)
            self.log.info("bootstrap_schedule_synced", downloaded=downloaded)
        except Exception as exc:
            self.log.warning("bootstrap_schedule_failed", error=str(exc))
            schedule = self.sync_client.load_local_schedule()

        self.current_campaigns = self._extract_current_campaigns(schedule)

        try:
            displays = self.edid_reader.scan_outputs()
            screen_map = {"HDMI-A-1": "screen-a", "HDMI-A-2": "screen-b", "DP-1": "screen-c"}
            self.edid_reader.push_display_info(screen_map, displays)
        except Exception as exc:
            self.log.warning("edid_bootstrap_failed", error=str(exc))

    def _start_background_loops(self) -> None:
        threading.Thread(target=self._heartbeat_loop, daemon=True).start()
        threading.Thread(target=self._schedule_sync_loop, daemon=True).start()
        threading.Thread(target=self._telemetry_loop, daemon=True).start()
        threading.Thread(target=self._pop_upload_loop, daemon=True).start()

    def _build_mqtt_client(self) -> mqtt.Client:
        client = mqtt.Client(client_id=self.config.device_id, protocol=mqtt.MQTTv311)
        client.tls_set(
            ca_certs=self.config.ca_path,
            certfile=self.config.cert_path,
            keyfile=self.config.key_path,
        )
        client.on_connect = self._on_mqtt_connect
        client.on_message = self._on_mqtt_message
        client.on_disconnect = self._on_mqtt_disconnect
        return client

    def _connect_mqtt(self) -> None:
        parsed = urlparse(self.config.mqtt_broker)
        host = parsed.hostname or "localhost"
        port = parsed.port or 8883
        self.mqtt_client.connect(host=host, port=port, keepalive=60)
        self.mqtt_client.loop_start()

    def _on_mqtt_connect(self, client: mqtt.Client, _userdata: Any, _flags: dict[str, Any], rc: int) -> None:
        if rc != 0:
            self.log.error("mqtt_connect_failed", rc=rc)
            return
        self.log.info("mqtt_connected")
        client.subscribe(f"adnexus/devices/{self.config.device_id}/commands", qos=1)
        client.subscribe("adnexus/fleet/emergency", qos=1)
        self._publish_heartbeat()

    def _on_mqtt_disconnect(self, _client: mqtt.Client, _userdata: Any, rc: int) -> None:
        self.log.warning("mqtt_disconnected", rc=rc)

    def _on_mqtt_message(self, _client: mqtt.Client, _userdata: Any, msg: mqtt.MQTTMessage) -> None:
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except json.JSONDecodeError:
            self.log.warning("mqtt_invalid_payload", topic=msg.topic)
            return

        command = payload.get("command")
        if not command:
            return
        self.log.info("command_received", topic=msg.topic, command=command)
        self._execute_command(str(command), payload.get("payload") or payload)

    def _execute_command(self, command: str, payload: dict[str, Any]) -> None:
        match command:
            case "RESTART":
                os.system("sudo reboot")
            case "SKIP_AD":
                self._signal_player_skip()
            case "SET_VOLUME":
                volume = int(payload.get("volume", 70))
                os.system(f"amixer set Master {max(0, min(volume, 100))}%")
            case "EMERGENCY_OVERRIDE":
                self._handle_emergency_override(payload)
            case "UPDATE_SCHEDULE":
                self._run_schedule_sync_once()
            case _:
                self.log.warning("unknown_command", command=command)

    def _handle_emergency_override(self, payload: dict[str, Any]) -> None:
        asset_url = payload.get("asset_url")
        campaign_id = payload.get("campaignId", "emergency")
        if not asset_url:
            self.log.warning("emergency_override_missing_asset")
            return
        ext = Path(urlparse(str(asset_url)).path).suffix or ".mp4"
        target_dir = Path(self.config.media_path) / str(campaign_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / f"override{ext}"
        response = requests.get(str(asset_url), timeout=20)
        response.raise_for_status()
        target_file.write_bytes(response.content)
        self._signal_player_emergency(str(target_file))
        self.log.info("emergency_override_loaded", file=str(target_file))

    def _heartbeat_loop(self) -> None:
        while not self.stop_event.wait(self.config.heartbeat_interval_s):
            self._publish_heartbeat()

    def _telemetry_loop(self) -> None:
        while not self.stop_event.wait(self.config.telemetry_interval_s):
            self._publish_telemetry()

    def _schedule_sync_loop(self) -> None:
        while not self.stop_event.wait(self.config.schedule_sync_interval_s):
            self._run_schedule_sync_once()

    def _pop_upload_loop(self) -> None:
        while not self.stop_event.wait(120):
            self.pop_logger.upload_pending()

    def _run_schedule_sync_once(self) -> None:
        try:
            schedule = self.sync_client.fetch_schedule()
            downloaded = self.sync_client.sync_assets(schedule)
            self.current_campaigns = self._extract_current_campaigns(schedule)
            self.log.info("schedule_sync_ok", downloaded=downloaded)
        except Exception as exc:
            self.log.warning("schedule_sync_failed", error=str(exc))

    def _publish_heartbeat(self) -> None:
        payload = {
            "device_id": self.config.device_id,
            "timestamp": datetime.now(tz=UTC).isoformat(),
            "status": "ONLINE",
            "player_status": "PLAYING",
            "current_campaigns": self.current_campaigns,
        }
        self.mqtt_client.publish(
            f"adnexus/devices/{self.config.device_id}/heartbeat",
            json.dumps(payload),
            qos=1,
        )

    def _publish_telemetry(self) -> None:
        disk = os.statvfs(self.config.media_path if Path(self.config.media_path).exists() else "/")
        total = disk.f_blocks * disk.f_frsize
        free = disk.f_bavail * disk.f_frsize
        used_percent = round(((total - free) / total) * 100, 2) if total else 0
        payload = {
            "cpu_temp_c": self._read_cpu_temp(),
            "disk_usage_percent": used_percent,
            "ram_usage_mb": self._read_ram_usage_mb(),
            "network": self._network_hint(),
            "timestamp": datetime.now(tz=UTC).isoformat(),
        }
        self.mqtt_client.publish(
            f"adnexus/devices/{self.config.device_id}/telemetry",
            json.dumps(payload),
            qos=1,
        )

    def _extract_current_campaigns(self, schedule: dict[str, Any]) -> dict[str, str]:
        campaigns = {"A": "", "B": "", "C": ""}
        screens = schedule.get("screens", {})
        for screen in ("A", "B", "C"):
            slots = screens.get(screen, {}).get("slots", [])
            if slots:
                campaigns[screen] = slots[0].get("campaign_id", "")
        return campaigns

    def _signal_player_skip(self) -> None:
        Path("/tmp/adnexus-player-skip").write_text("1", encoding="utf-8")

    def _signal_player_emergency(self, file_path: str) -> None:
        Path("/tmp/adnexus-player-emergency").write_text(file_path, encoding="utf-8")

    def _signal_player_finish_asset(self) -> None:
        Path("/tmp/adnexus-player-finish-current").write_text("1", encoding="utf-8")

    def _read_cpu_temp(self) -> float:
        thermal = Path("/sys/class/thermal/thermal_zone0/temp")
        if thermal.exists():
            return round(int(thermal.read_text(encoding="utf-8").strip()) / 1000, 2)
        return 0.0

    def _read_ram_usage_mb(self) -> float:
        values: dict[str, int] = {}
        for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
            key, rest = line.split(":", maxsplit=1)
            values[key] = int(rest.strip().split()[0])
        total = values.get("MemTotal", 0)
        avail = values.get("MemAvailable", 0)
        used_kb = max(total - avail, 0)
        return round(used_kb / 1024, 2)

    def _network_hint(self) -> str:
        return "WiFi+4G-managed"

    def _read_acc_signal(self) -> bool:
        return Path("/tmp/adnexus-acc-state").read_text(encoding="utf-8").strip() != "LOW" if Path("/tmp/adnexus-acc-state").exists() else True

    def _read_voltage(self) -> float:
        file = Path("/tmp/adnexus-voltage")
        if file.exists():
            return float(file.read_text(encoding="utf-8").strip())
        return 12.4

    def _handle_sigterm(self, _sig: int, _frame: Any) -> None:
        self.stop_event.set()


def main() -> None:
    configure_logging()
    config = load_config("/etc/adnexus/config.json")
    EdgeAgent(config).start()


if __name__ == "__main__":
    main()

