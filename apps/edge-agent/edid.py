from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import requests
import structlog

from config import AgentConfig


@dataclass
class DisplayInfo:
    output: str
    native_resolution: str
    refresh_rate: int
    monitor_name: str
    display_type: str
    aspect_ratio: str
    rotation: int


class EDIDReader:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.log = structlog.get_logger("edid").bind(device_id=config.device_id)

    def scan_outputs(self, outputs: Iterable[str] = ("HDMI-A-1", "HDMI-A-2", "DP-1")) -> dict[str, DisplayInfo]:
        mapped: dict[str, DisplayInfo] = {}
        for output in outputs:
            edid_path = Path(f"/sys/class/drm/card0-{output}/edid")
            if not edid_path.exists():
                continue
            blob = edid_path.read_bytes()
            info = self._parse_blob(output, blob)
            mapped[output] = info
        self._persist_local(mapped)
        return mapped

    def push_display_info(self, screen_map: dict[str, str], displays: dict[str, DisplayInfo], timeout_s: int = 10) -> int:
        pushed = 0
        for output, info in displays.items():
            screen_id = screen_map.get(output)
            if not screen_id:
                continue
            endpoint = f"{self.config.api_url}/api/v1/screens/{screen_id}/display-info"
            response = requests.put(endpoint, json={"displayInfo": asdict(info)}, timeout=timeout_s)
            response.raise_for_status()
            pushed += 1
        self.log.info("display_info_pushed", count=pushed)
        return pushed

    def _persist_local(self, displays: dict[str, DisplayInfo]) -> None:
        payload = {key: asdict(value) for key, value in displays.items()}
        self.config.displays_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self.log.info("display_info_saved", path=str(self.config.displays_file), count=len(payload))

    def _parse_blob(self, output: str, blob: bytes) -> DisplayInfo:
        width = 1920
        height = 1080
        refresh = 60
        if len(blob) >= 72:
            h_active_lo = blob[56]
            h_hi = (blob[58] >> 4) & 0xF
            v_active_lo = blob[59]
            v_hi = (blob[61] >> 4) & 0xF
            parsed_w = (h_hi << 8) | h_active_lo
            parsed_h = (v_hi << 8) | v_active_lo
            if parsed_w > 0 and parsed_h > 0:
                width, height = parsed_w, parsed_h

        monitor_name = output
        display_type = self._classify(monitor_name)
        ratio = self._aspect_ratio(width, height)
        rotation = 90 if height > width else 0

        return DisplayInfo(
            output=output,
            native_resolution=f"{width}x{height}",
            refresh_rate=refresh,
            monitor_name=monitor_name,
            display_type=display_type,
            aspect_ratio=ratio,
            rotation=rotation,
        )

    def _aspect_ratio(self, width: int, height: int) -> str:
        if height == 0:
            return "unknown"
        ratio = round(width / height, 2)
        if abs(ratio - 1.78) < 0.08:
            return "16:9"
        if abs(ratio - 1.6) < 0.08:
            return "16:10"
        if abs(ratio - 1.33) < 0.08:
            return "4:3"
        return f"{width}:{height}"

    def _classify(self, name: str) -> str:
        label = name.lower()
        if "proj" in label:
            return "Projector"
        if "led" in label:
            return "LED_Panel"
        if "tv" in label:
            return "TV"
        return "Monitor"

