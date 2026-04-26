import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceCertGuard } from '../auth/device-cert.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post(':id/heartbeat')
  @UseGuards(DeviceCertGuard)
  heartbeat(@Param('id') id: string, @Body() dto: HeartbeatDto) {
    return this.devicesService.heartbeat(id, dto);
  }

  @Post(':id/reconcile-offline')
  @UseGuards(JwtAuthGuard)
  markOfflineSweep() {
    return this.devicesService.markOfflineIfStale();
  }
}

