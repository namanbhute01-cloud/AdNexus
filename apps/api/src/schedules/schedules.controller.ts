import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchedulesService } from './schedules.service';
import { CreateSlotDto } from './dto/create-slot.dto';

@Controller()
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post('schedules')
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateSlotDto) {
    return this.schedulesService.createSlot(dto);
  }

  @Delete('schedules/:id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string) {
    return this.schedulesService.deleteSlot(id);
  }

  @Get('devices/:id/schedule')
  getDeviceSchedule(@Param('id') id: string) {
    return this.schedulesService.getDeviceSchedule(id);
  }
}

