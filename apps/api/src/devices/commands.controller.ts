import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SendCommandDto } from './dto/send-command.dto';
import { SchedulesService } from '../schedules/schedules.service';

@Controller('commands')
@UseGuards(JwtAuthGuard)
export class CommandsController {
  constructor(
    private readonly devicesService: DevicesService,
    private readonly schedulesService: SchedulesService,
  ) {}

  @Post('device/:id/restart')
  restartDevice(@Param('id') id: string) {
    return this.devicesService.sendCommand(id, 'RESTART');
  }

  @Post('device/:id/skip')
  skipCurrent(@Param('id') id: string) {
    return this.devicesService.sendCommand(id, 'SKIP_AD');
  }

  @Post('device/:id/send')
  sendDeviceCommand(@Param('id') id: string, @Body() dto: SendCommandDto) {
    return this.devicesService.sendCommand(id, dto.command, dto.payload ?? {});
  }

  @Post('emergency-override')
  emergencyOverride(@Body() body: { campaignId: string; deviceIds?: string[] }) {
    return this.schedulesService.emergencyOverride(body.campaignId, body.deviceIds ?? []);
  }
}

