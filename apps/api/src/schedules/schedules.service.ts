import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, LessThan } from 'typeorm';
import { randomUUID } from 'crypto';
import { PlayMode, ScheduleEntity, ScheduleScreenPosition } from '../database/entities/schedule.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { ScreenEntity, ScreenPosition } from '../database/entities/screen.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { MqttGatewayService } from '../mqtt-gateway/mqtt-gateway.service';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(ScheduleEntity)
    private readonly schedulesRepo: Repository<ScheduleEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaignsRepo: Repository<CampaignEntity>,
    @InjectRepository(ScreenEntity)
    private readonly screensRepo: Repository<ScreenEntity>,
    private readonly mqttGatewayService: MqttGatewayService,
  ) {}

  // FIX-01: EV-Scoped Sync Not Enforced
  // Updated to correctly handle screenPosition ALL
  async validateSyncScope(screenIds: string[], mode: PlayMode, deviceId: string) {
    if (mode === PlayMode.INDEPENDENT) return;

    const screens = await this.screensRepo.findByIds(screenIds);
    const evIds = new Set(screens.map(s => s.deviceId));

    // If ALL is selected for screenPosition, it implies all screens on the *same* device.
    // Thus, evIds.size should always be 1 if the input screenIds belong to the specified deviceId.
    // If screenIds are provided and they belong to different deviceIds, it's an error.
    if (evIds.size > 1) {
      throw new BadRequestException(
        'MIRROR/COMBINED mode requires all screens on the same EV unit. ' +
        'These screens belong to different EVs.'
      );
    }
  }

  // FIX-12: Schedule Overlap Not Validated
  async checkOverlap(deviceId: string, screenPosition: ScheduleScreenPosition, start: Date, end: Date, excludeId?: string) {
    const queryBuilder = this.schedulesRepo
      .createQueryBuilder('s')
      .where('s.device_id = :deviceId', { deviceId })
      .andWhere('s.start_time < :end', { end })
      .andWhere('s.end_time > :start', { start })
      .andWhere('s.id != :excludeId', { excludeId });

    if (screenPosition === ScheduleScreenPosition.ALL) {
      // If ALL, check for overlaps on any screen of this device
      queryBuilder.andWhere('s.screen_position IN (:...positions)', {
        positions: [ScheduleScreenPosition.A, ScheduleScreenPosition.B, ScheduleScreenPosition.C],
      });
    } else {
      // Otherwise, check specific screen position
      queryBuilder.andWhere('s.screen_position = :screenPosition', { screenPosition });
    }

    const overlapping = await queryBuilder.getMany();

    if (overlapping.length > 0) {
      throw new ConflictException(
        `Schedule overlaps with existing slot(s): ${overlapping.map(s => s.id).join(', ')}`
      );
    }
  }

  async createSlot(dto: CreateSlotDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be greater than startTime');
    }

    // FIX-01: EV-Scoped Sync Not Enforced
    await this.validateSyncScope([dto.deviceId], dto.playMode, dto.deviceId);

    const campaign = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${dto.campaignId} not found`);

    // FIX-12: Schedule Overlap Not Validated
    await this.checkOverlap(dto.deviceId, dto.screenPosition, start, end);

    const slot = this.schedulesRepo.create({
      id: randomUUID(),
      campaignId: dto.campaignId,
      deviceId: dto.deviceId,
      screenPosition: dto.screenPosition,
      playMode: dto.playMode,
      startTime: start,
      endTime: end,
      repeatInterval: dto.repeatInterval,
    });
    return this.schedulesRepo.save(slot);
  }

  async deleteSlot(id: string) {
    await this.schedulesRepo.delete({ id });
    return { ok: true };
  }

  async getDeviceSchedule(deviceId: string) {
    const slots = await this.schedulesRepo.find({
      where: { deviceId },
      order: { startTime: 'ASC' },
    });
    const screens = await this.screensRepo.find({ where: { deviceId } });
    const campaignIds = slots.map((slot) => slot.campaignId).filter(Boolean);
    const campaigns = campaignIds.length
      ? await this.campaignsRepo.findBy({ id: In(campaignIds) })
      : [];
    const campaignById = new Map(campaigns.map((item) => [item.id, item]));
    const screenMap: Record<string, { mode: string; slots: unknown[] }> = {
      A: { mode: 'INDEPENDENT', slots: [] },
      B: { mode: 'INDEPENDENT', slots: [] },
      C: { mode: 'INDEPENDENT', slots: [] },
    };

    for (const slot of slots) {
      const targetScreens =
        slot.screenPosition === ScheduleScreenPosition.ALL
          ? [ScreenPosition.A, ScreenPosition.B, ScreenPosition.C]
          : [this.toScreenPosition(slot.screenPosition)];
      const campaign = campaignById.get(slot.campaignId);
      for (const screen of targetScreens) {
        screenMap[screen].mode = slot.playMode;
        screenMap[screen].slots.push({
          campaign_id: slot.campaignId,
          asset_url: campaign?.mediaUrl ?? '',
          asset_checksum: campaign?.mediaChecksum ?? '',
          start_time: slot.startTime.toISOString(),
          end_time: slot.endTime.toISOString(),
          loop: true,
        });
      }
    }

    const knownPositions = new Set(screens.map((screen) => screen.position));
    if (!knownPositions.has(ScreenPosition.A)) screenMap.A = { mode: 'INDEPENDENT', slots: [] };
    if (!knownPositions.has(ScreenPosition.B)) screenMap.B = { mode: 'INDEPENDENT', slots: [] };
    if (!knownPositions.has(ScreenPosition.C)) screenMap.C = { mode: 'INDEPENDENT', slots: [] };

    return {
      device_id: deviceId,
      generated_at: new Date().toISOString(),
      screens: screenMap,
    };
  }

  async emergencyOverride(campaignId: string, deviceIds: string[]) {
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${campaignId} not found`);
    const start = new Date();
    const end = new Date(start.getTime() + 15 * 60 * 1000);

    const targets =
      deviceIds.length > 0
        ? deviceIds
        : (await this.screensRepo
            .createQueryBuilder('s')
            .select('DISTINCT s.device_id', 'device_id')
            .getRawMany<{ device_id: string }>())
            .map((row) => row.device_id);

    const toSave = targets.map((deviceId) =>
      this.schedulesRepo.create({
        id: randomUUID(),
        campaignId,
        deviceId,
        screenPosition: ScheduleScreenPosition.ALL,
        playMode: PlayMode.MIRROR,
        startTime: start,
        endTime: end,
      }),
    );
    if (toSave.length > 0) {
      await this.schedulesRepo.save(toSave);
    }

    await this.mqttGatewayService.publishFleetEmergency({
      command: 'EMERGENCY_OVERRIDE',
      campaignId,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      deviceIds: targets,
    });

    return { ok: true, affectedDevices: targets.length };
  }

  private toScreenPosition(value: ScheduleScreenPosition): ScreenPosition {
    if (value === ScheduleScreenPosition.A) return ScreenPosition.A;
    if (value === ScheduleScreenPosition.B) return ScreenPosition.B;
    return ScreenPosition.C;
  }
}
