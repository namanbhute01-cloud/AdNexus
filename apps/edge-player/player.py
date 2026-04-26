from __future__ import annotations

import json
import math
import signal
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import structlog
from mpv import MPV

from player_ipc import MPVIpc
from playlist import PlaylistBuilder

Screen = Literal["A", "B", "C"]


@dataclass
class DisplayConfig:
    screen_index: int
    resolution: str
    rotation: int
    zoom: float


class PlayerController:
    def __init__(
        self,
        displays_path: str = "/config/displays.json",
        schedule_path: str = "/config/schedule.json",
        media_root: str = "/media/campaigns",
    ) -> None:
        self.displays_path = Path(displays_path)
        self.schedule_path = Path(schedule_path)
        self.media_root = Path(media_root)
        self.log = structlog.get_logger("edge_player")
        self.stop_event = threading.Event()
        self.players: dict[Screen, MPV] = {}
        self.builder = PlaylistBuilder(
            schedule_path=str(schedule_path),
            media_root=str(media_root),
        )
        self.ipc = MPVIpc(
            sockets={
                "A": "/tmp/mpv-sock-A",
                "B": "/tmp/mpv-sock-B",
                "C": "/tmp/mpv-sock-C",
            },
        )

    def start(self) -> None:
        signal.signal(signal.SIGTERM, self._handle_stop)
        signal.signal(signal.SIGINT, self._handle_stop)

        displays = self._load_displays()
        playlists = self.builder.build()
        sync_base = self._next_round_minute()
        running_time = max(time.time() - sync_base, 0)

        for screen in ("A", "B", "C"):
            player = self._create_player(screen, displays[screen], running_time)
            self.players[screen] = player
            self._load_playlist(screen, playlists[screen])

        threading.Thread(target=self._watch_external_signals, daemon=True).start()
        threading.Thread(target=self._prefetch_loop, daemon=True).start()

        self.log.info("player_started", sync_base_time=sync_base, running_time=running_time)
        while not self.stop_event.is_set():
            time.sleep(1)
        self.stop()

    def stop(self) -> None:
        self.stop_event.set()
        for screen, player in self.players.items():
            try:
                player.terminate()
            except Exception as exc:
                self.log.warning("terminate_failed", screen=screen, error=str(exc))
        self.log.info("player_stopped")

    def _create_player(self, screen: Screen, display: DisplayConfig, start_at: float) -> MPV:
        socket_path = self.ipc.sockets[screen]
        Path(socket_path).unlink(missing_ok=True)

        # MPV uses integer display index; geometry is handled by fullscreen output.
        player = MPV(
            input_ipc_server=socket_path,
            fullscreen=True,
            loop_playlist="inf",
            hwdec="auto",
            vo="gpu",
            gpu_api="vulkan",
            cache=True,
            cache_secs=60,
            demuxer_max_bytes=500 * 1024 * 1024,
            screen=display.screen_index,
            video_rotate=display.rotation,
            video_zoom=display.zoom,
            start=start_at,
            keep_open="yes",
        )
        return player

    def _load_playlist(self, screen: Screen, files: list[str]) -> None:
        player = self.players[screen]
        if not files:
            return
        first, *rest = files
        player.play(first)
        for item in rest:
            player.command("loadfile", item, "append-play")
        self.log.info("playlist_loaded", screen=screen, items=len(files))

    def _load_displays(self) -> dict[Screen, DisplayConfig]:
        default = {
            "A": DisplayConfig(0, "1920x1080", 0, 0.0),
            "B": DisplayConfig(1, "1920x1080", 0, 0.0),
            "C": DisplayConfig(2, "1920x1080", 0, 0.0),
        }
        if not self.displays_path.exists():
            return default

        payload = json.loads(self.displays_path.read_text(encoding="utf-8"))
        mapped: dict[Screen, DisplayConfig] = {}
        output_to_screen: dict[str, Screen] = {"HDMI-A-1": "A", "HDMI-A-2": "B", "DP-1": "C"}
        screen_index: dict[str, int] = {"A": 0, "B": 1, "C": 2}
        for output, info in payload.items():
            screen = output_to_screen.get(output)
            if not screen:
                continue
            rotation = int(info.get("rotation", 0))
            aspect = str(info.get("aspect_ratio", "16:9"))
            zoom = self._compute_zoom(aspect)
            mapped[screen] = DisplayConfig(
                screen_index=screen_index[screen],
                resolution=str(info.get("native_resolution", "1920x1080")),
                rotation=rotation,
                zoom=zoom,
            )
        return {**default, **mapped}

    def _compute_zoom(self, aspect_ratio: str) -> float:
        if aspect_ratio == "16:9":
            return 0.0
        if aspect_ratio == "16:10":
            return -0.03
        if aspect_ratio == "4:3":
            return -0.15
        return 0.0

    def _next_round_minute(self) -> float:
        now = datetime.now(tz=UTC).timestamp()
        return math.ceil(now / 60.0) * 60.0

    def _prefetch_loop(self) -> None:
        while not self.stop_event.wait(5):
            preloads = self.builder.preloads_for_next_30s()
            for screen, assets in preloads.items():
                for asset in assets:
                    if Path(asset).exists():
                        # no-op pre-read placeholder for future memory warm-up hooks.
                        _ = Path(asset).stat().st_size
                        self.log.info("prefetch_candidate", screen=screen, asset=asset)

    def _watch_external_signals(self) -> None:
        skip_flag = Path("/tmp/adnexus-player-skip")
        emergency_flag = Path("/tmp/adnexus-player-emergency")
        finish_flag = Path("/tmp/adnexus-player-finish-current")

        while not self.stop_event.wait(1):
            if skip_flag.exists():
                skip_flag.unlink(missing_ok=True)
                for screen in ("A", "B", "C"):
                    self.ipc.skip_current(screen)
                self.log.info("external_skip_applied")

            if emergency_flag.exists():
                path = emergency_flag.read_text(encoding="utf-8").strip()
                emergency_flag.unlink(missing_ok=True)
                for screen in ("A", "B", "C"):
                    self.ipc.load_emergency(screen, path)
                self.log.warning("external_emergency_loaded", file=path)

            if finish_flag.exists():
                finish_flag.unlink(missing_ok=True)
                while True:
                    pos = self.ipc.get_current_position("A")
                    if pos is None:
                        break
                    # Wait for loop boundary approximation.
                    time.sleep(0.5)
                    now_pos = self.ipc.get_current_position("A")
                    if now_pos is not None and now_pos < pos:
                        break
                self.stop_event.set()
                self.log.info("finish_current_asset_then_stop")

    def _handle_stop(self, _sig: int, _frame: Any) -> None:
        self.stop_event.set()


def main() -> None:
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_log_level,
            structlog.processors.JSONRenderer(),
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
    )
    PlayerController().start()


if __name__ == "__main__":
    main()

