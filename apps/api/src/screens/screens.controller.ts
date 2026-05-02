import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ScreensService } from './screens.service';
import { UpdateDisplayInfoDto } from './dto/update-display-info.dto';
import * as bcrypt from 'bcrypt';

@Controller()
export class ScreensController {
  constructor(private readonly screensService: ScreensService) {}

  @Get('devices/:id/screens')
  @UseGuards(JwtAuthGuard)
  getDeviceScreens(@Param('id') id: string) {
    return this.screensService.getDeviceScreens(id);
  }

  @Patch(':id/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async resetPassword(
    @Param('id') id: string,
    @Body('password') password: string,
  ) {
    const saltOrRounds = 12;
    const hash = await bcrypt.hash(password, saltOrRounds);
    return this.screensService.updatePassword(id, hash);
  }

  @Put('screens/:id/display-info')
  @UseGuards(DeviceCertGuard)
  updateDisplayInfo(@Param('id') id: string, @Body() dto: UpdateDisplayInfoDto) {
    return this.screensService.updateDisplayInfo(id, dto.displayInfo);
  }
}

