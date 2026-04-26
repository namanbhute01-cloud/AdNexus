import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { DeviceCertGuard } from '../auth/device-cert.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ScreensService } from './screens.service';
import { UpdateDisplayInfoDto } from './dto/update-display-info.dto';

@Controller()
export class ScreensController {
  constructor(private readonly screensService: ScreensService) {}

  @Get('devices/:id/screens')
  @UseGuards(JwtAuthGuard)
  getDeviceScreens(@Param('id') id: string) {
    return this.screensService.getDeviceScreens(id);
  }

  @Put('screens/:id/display-info')
  @UseGuards(DeviceCertGuard)
  updateDisplayInfo(@Param('id') id: string, @Body() dto: UpdateDisplayInfoDto) {
    return this.screensService.updateDisplayInfo(id, dto.displayInfo);
  }
}

