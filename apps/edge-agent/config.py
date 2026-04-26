from __future__ import annotations

from pathlib import Path
from pydantic import BaseModel, Field, HttpUrl


class AgentConfig(BaseModel):
    device_id: str
    serial_number: str
    api_url: HttpUrl
    mqtt_broker: str
    cert_path: str
    key_path: str
    ca_path: str
    media_path: str = "/media/campaigns"
    config_path: str = "/config"
    heartbeat_interval_s: int = Field(default=30, ge=5)
    schedule_sync_interval_s: int = Field(default=900, ge=60)
    telemetry_interval_s: int = Field(default=60, ge=10)
    lvco_voltage_threshold: float = 11.0
    ignition_off_delay_s: int = Field(default=60, ge=5)
    screens: list[str] = Field(default_factory=lambda: ["A", "B", "C"])

    @property
    def schedule_file(self) -> Path:
        return Path(self.config_path) / "schedule.json"

    @property
    def displays_file(self) -> Path:
        return Path(self.config_path) / "displays.json"


def load_config(path: str = "/etc/adnexus/config.json") -> AgentConfig:
    return AgentConfig.model_validate_json(Path(path).read_text(encoding="utf-8"))

