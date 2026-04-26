from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse

import requests
import structlog

from config import AgentConfig


class SyncClient:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self.media_root = Path(config.media_path)
        self.media_root.mkdir(parents=True, exist_ok=True)
        Path(config.config_path).mkdir(parents=True, exist_ok=True)
        self.log = structlog.get_logger("sync_client").bind(device_id=config.device_id)

    def fetch_schedule(self, timeout_s: int = 10) -> dict:
        endpoint = f"{self.config.api_url}/api/v1/devices/{self.config.device_id}/schedule"
        response = requests.get(endpoint, timeout=timeout_s)
        response.raise_for_status()
        schedule = response.json()
        self.config.schedule_file.write_text(json.dumps(schedule, indent=2), encoding="utf-8")
        self.log.info("schedule_saved", path=str(self.config.schedule_file))
        return schedule

    def load_local_schedule(self) -> dict:
        if not self.config.schedule_file.exists():
            return {"screens": {}}
        return json.loads(self.config.schedule_file.read_text(encoding="utf-8"))

    def sync_assets(self, schedule: dict, timeout_s: int = 30) -> int:
        downloaded = 0
        for slot in self._iter_slots(schedule):
            campaign_id = slot.get("campaign_id")
            url = slot.get("asset_url")
            checksum = slot.get("asset_checksum", "")
            if not campaign_id or not url:
                continue

            parsed = urlparse(url)
            suffix = Path(parsed.path).suffix or ".bin"
            asset_dir = self.media_root / campaign_id
            asset_dir.mkdir(parents=True, exist_ok=True)
            asset_file = asset_dir / f"asset{suffix}"

            if asset_file.exists() and self._checksum_ok(asset_file, checksum):
                continue

            response = requests.get(url, stream=True, timeout=timeout_s)
            response.raise_for_status()
            tmp = asset_file.with_suffix(asset_file.suffix + ".part")
            with tmp.open("wb") as handle:
                for chunk in response.iter_content(chunk_size=1024 * 512):
                    if chunk:
                        handle.write(chunk)

            if not self._checksum_ok(tmp, checksum):
                tmp.unlink(missing_ok=True)
                raise ValueError(f"Checksum mismatch for {campaign_id}")

            tmp.replace(asset_file)
            downloaded += 1
            self.log.info("asset_synced", campaign_id=campaign_id, path=str(asset_file))
        return downloaded

    def prefetch_next_day(self, timeout_s: int = 10) -> int:
        tomorrow = datetime.now(tz=UTC).date() + timedelta(days=1)
        endpoint = f"{self.config.api_url}/api/v1/devices/{self.config.device_id}/schedule"
        response = requests.get(endpoint, params={"date": tomorrow.isoformat()}, timeout=timeout_s)
        response.raise_for_status()
        schedule = response.json()
        return self.sync_assets(schedule)

    def _iter_slots(self, schedule: dict):
        screens = schedule.get("screens", {})
        for payload in screens.values():
            for slot in payload.get("slots", []):
                yield slot

    def _checksum_ok(self, path: Path, expected: str) -> bool:
        if not expected:
            return True
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        normalized = expected.removeprefix("sha256:")
        return digest == normalized

