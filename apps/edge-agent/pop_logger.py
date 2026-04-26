from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import requests
import structlog


@dataclass
class PoPEvent:
    campaign_id: str
    screen: str
    started_at: str
    duration_s: int


class PoPLogger:
    def __init__(self, device_id: str, api_url: str, log_path: str = "/var/log/adnexus/pop.jsonl") -> None:
        self.device_id = device_id
        self.api_url = api_url.rstrip("/")
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self.log = structlog.get_logger("pop_logger").bind(device_id=device_id)

    def log_event(self, event: PoPEvent) -> None:
        record = {
            "campaign_id": event.campaign_id,
            "screen": event.screen,
            "started_at": event.started_at,
            "duration_s": event.duration_s,
            "uploaded": False,
            "created_at": datetime.now(tz=UTC).isoformat(),
        }
        with self.log_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record) + "\n")
        self.log.info("pop_logged", campaign_id=event.campaign_id, screen=event.screen)

    def upload_pending(self, timeout_s: int = 10) -> int:
        if not self.log_path.exists():
            return 0

        rows = [json.loads(line) for line in self.log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        pending = [row for row in rows if not row.get("uploaded")]
        if not pending:
            return 0

        payload = [
            {
                "campaign_id": row["campaign_id"],
                "screen_id": row["screen"],
                "played_at": row["started_at"],
                "duration_played_seconds": row["duration_s"],
            }
            for row in pending
        ]
        endpoint = f"{self.api_url}/api/v1/devices/{self.device_id}/proof-of-play"
        try:
            response = requests.post(endpoint, json=payload, timeout=timeout_s)
            response.raise_for_status()
        except requests.RequestException as exc:
            self.log.warning("pop_upload_failed", error=str(exc), pending=len(pending))
            return 0

        for row in rows:
            if not row.get("uploaded"):
                row["uploaded"] = True
                row["uploaded_at"] = datetime.now(tz=UTC).isoformat()
        with self.log_path.open("w", encoding="utf-8") as handle:
            for row in rows:
                handle.write(json.dumps(row) + "\n")
        self.log.info("pop_uploaded", count=len(pending))
        return len(pending)

