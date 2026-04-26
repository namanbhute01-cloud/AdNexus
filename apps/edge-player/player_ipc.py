from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

Screen = Literal["A", "B", "C"]


@dataclass
class MPVIpc:
    sockets: dict[Screen, str]

    def _send(self, screen: Screen, command: list[Any]) -> dict[str, Any] | None:
        sock_path = self.sockets[screen]
        if not Path(sock_path).exists():
            return None

        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.connect(sock_path)
            payload = json.dumps({"command": command}).encode("utf-8") + b"\n"
            client.sendall(payload)
            data = client.recv(8192)
            if not data:
                return None
            return json.loads(data.decode("utf-8"))

    def skip_current(self, screen: Screen) -> dict[str, Any] | None:
        return self._send(screen, ["playlist-next"])

    def set_volume(self, screen: Screen, volume: float) -> dict[str, Any] | None:
        return self._send(screen, ["set_property", "volume", volume])

    def load_emergency(self, screen: Screen, path: str) -> dict[str, Any] | None:
        return self._send(screen, ["loadfile", path, "replace"])

    def get_current_position(self, screen: Screen) -> float | None:
        data = self._send(screen, ["get_property", "time-pos"])
        if not data:
            return None
        value = data.get("data")
        return float(value) if isinstance(value, (float, int)) else None

    def pause(self, screen: Screen) -> dict[str, Any] | None:
        return self._send(screen, ["set_property", "pause", True])

    def resume(self, screen: Screen) -> dict[str, Any] | None:
        return self._send(screen, ["set_property", "pause", False])

