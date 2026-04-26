import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { DeviceCertGuard } from '../auth/device-cert.guard';
import { ProofOfPlayService } from './proof-of-play.service';
import { ProofOfPlayEventDto } from './dto/proof-of-play-event.dto';

@Controller('devices/:id/proof-of-play')
export class ProofOfPlayController {
  constructor(private readonly proofOfPlayService: ProofOfPlayService) {}

  @Post()
  @UseGuards(DeviceCertGuard)
  upload(@Param('id') id: string, @Body() events: ProofOfPlayEventDto[]) {
    return this.proofOfPlayService.bulkUpload(id, events);
  }
}

