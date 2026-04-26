import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DeviceCertGuard } from './device-cert.guard';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { DevicesService } from '../devices/devices.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register-device')
  @UseGuards(DeviceCertGuard)
  registerDevice(@Body() dto: RegisterDeviceDto) {
    return this.devicesService.registerDevice(dto.serial, dto.organizationId, dto.cert);
  }
}

