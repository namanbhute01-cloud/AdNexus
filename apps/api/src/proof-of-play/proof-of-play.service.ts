import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ProofOfPlayEntity } from '../database/entities/proof-of-play.entity';
import { ProofOfPlayEventDto } from './dto/proof-of-play-event.dto';

@Injectable()
export class ProofOfPlayService {
  constructor(
    @InjectRepository(ProofOfPlayEntity)
    private readonly popRepo: Repository<ProofOfPlayEntity>,
  ) {}

  async bulkUpload(deviceId: string, events: ProofOfPlayEventDto[]) {
    const rows = events.map((event) =>
      this.popRepo.create({
        id: randomUUID(),
        deviceId,
        screenId: event.screen_id,
        campaignId: event.campaign_id,
        playedAt: new Date(event.played_at),
        durationPlayedSeconds: event.duration_played_seconds,
        uploadedAt: new Date(),
      }),
    );
    if (rows.length > 0) {
      await this.popRepo.save(rows);
    }
    return { ok: true, uploaded: rows.length };
  }
}

