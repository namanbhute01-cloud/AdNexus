from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
import structlog

logger = structlog.get_logger(__name__)

Screen = Literal["A", "B", "C"]
Mode = Literal["MIRROR", "INDEPENDENT", "COMBINED"]

DEFAULT_FILLER = '/media/default_filler.mp4'

@dataclass
class Slot:
    campaign_id: str
    asset_url: str
    asset_checksum: str
    start_time: datetime
    end_time: datetime
    loop: bool


class PlaylistBuilder:
    def __init__(
        self,
        schedule_path: str = "/config/schedule.json",
        media_root: str = "/media/campaigns",
        filler_path: str = DEFAULT_FILLER,
    ) -> None:
        self.schedule_path = Path(schedule_path)
        self.media_root = Path(media_root)
        self.filler_path = Path(filler_path)

    def load_schedule(self) -> dict:
        try:
            with open(self.schedule_path) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            logger.warning('No valid schedule.json — playing default filler')
            return {
                'screens': {
                    'A': {'mode': 'MIRROR', 'slots': [{'asset_url': DEFAULT_FILLER, 'campaign_id': 'filler', 'start_time': datetime.now(tz=UTC).isoformat()}]},
                    'B': {'mode': 'MIRROR', 'slots': [{'asset_url': DEFAULT_FILLER, 'campaign_id': 'filler', 'start_time': datetime.now(tz=UTC).isoformat()}]},
                    'C': {'mode': 'MIRROR', 'slots': [{'asset_url': DEFAULT_FILLER, 'campaign_id': 'filler', 'start_time': datetime.now(tz=UTC).isoformat()}]},
                }
            }

    def build(self) -> dict[Screen, list[str]]:
        schedule = self.load_schedule()
        screens = schedule.get("screens", {})

        mode = self._dominant_mode(screens)
        if mode == "MIRROR":
            source = self._build_screen_playlist(screens.get("A", {}).get("slots", []))
            return {"A": source, "B": list(source), "C": list(source)}

        if mode == "COMBINED":
            combined = self._build_screen_playlist(screens.get("A", {}).get("slots", []))
            return {
                "A": [f"{item}#crop=left" for item in combined],
                "B": [f"{item}#crop=center" for item in combined],
                "C": [f"{item}#crop=right" for item in combined],
            }

        return {
            "A": self._build_screen_playlist(screens.get("A", {}).get("slots", [])),
            "B": self._build_screen_playlist(screens.get("B", {}).get("slots", [])),
            "C": self._build_screen_playlist(screens.get("C", {}).get("slots", [])),
        }

    def preloads_for_next_30s(self) -> dict[Screen, list[str]]:
        schedule = self.load_schedule()
        now = datetime.now(tz=UTC)
        horizon = now.timestamp() + 30
        result: dict[Screen, list[str]] = {"A": [], "B": [], "C": []}

        for screen in ("A", "B", "C"):
            slots = schedule.get("screens", {}).get(screen, {}).get("slots", [])
            for slot in slots:
                try:
                    start_ts = datetime.fromisoformat(slot["start_time"].replace("Z", "+00:00")).timestamp()
                    if now.timestamp() <= start_ts <= horizon:
                        result[screen].append(self._asset_path(slot["campaign_id"], slot["asset_url"]))
                except (KeyError, ValueError):
                    continue
        return result

    def _dominant_mode(self, screens: dict) -> Mode:
        for screen in ("A", "B", "C"):
            maybe = screens.get(screen, {}).get("mode")
            if maybe in ("MIRROR", "INDEPENDENT", "COMBINED"):
                return maybe
        return "INDEPENDENT"

    def _build_screen_playlist(self, raw_slots: list[dict]) -> list[str]:
        ordered = sorted(
            raw_slots,
            key=lambda slot: datetime.fromisoformat(slot["start_time"].replace("Z", "+00:00")),
        )
        out: list[str] = []
        for slot in ordered:
            out.append(self._asset_path(slot["campaign_id"], slot["asset_url"]))
        return out if out else [str(self.filler_path)]

    def _asset_path(self, campaign_id: str, asset_url: str) -> str:
        if asset_url == DEFAULT_FILLER:
            return DEFAULT_FILLER
        suffix = Path(asset_url.split("?")[0]).suffix or ".mp4"
        candidate = self.media_root / campaign_id / f"asset{suffix}"
        return str(candidate if candidate.exists() else self.filler_path)
