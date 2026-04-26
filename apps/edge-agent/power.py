from __future__ import annotations

import os
import time
from collections.abc import Callable

import structlog

from config import AgentConfig
from pop_logger import PoPLogger


class PowerManager:
    def __init__(
        self,
        config: AgentConfig,
        pop_logger: PoPLogger,
        ignition_reader: Callable[[], bool],
        voltage_reader: Callable[[], float],
        on_finish_current_asset: Callable[[], None],
    ) -> None:
        self.config = config
        self.pop_logger = pop_logger
        self.ignition_reader = ignition_reader
        self.voltage_reader = voltage_reader
        self.on_finish_current_asset = on_finish_current_asset
        self.log = structlog.get_logger("power").bind(device_id=config.device_id)

    def monitor_once(self) -> None:
        voltage = self.voltage_reader()
        if voltage < self.config.lvco_voltage_threshold:
            self.log.warning("lvco_threshold_reached", voltage=voltage)
            self.shutdown_now()
            return

        if not self.ignition_reader():
            self.handle_acc_low()

    def handle_acc_low(self) -> None:
        delay_s = self.config.ignition_off_delay_s
        self.log.info("acc_low_detected", off_delay_s=delay_s)
        time.sleep(delay_s)

        if self.ignition_reader():
            self.log.info("acc_restored_before_shutdown")
            return

        self.on_finish_current_asset()
        self.pop_logger.upload_pending()
        self.shutdown_now()

    def shutdown_now(self) -> None:
        self.log.warning("poweroff_triggered")
        os.system("sudo poweroff")

