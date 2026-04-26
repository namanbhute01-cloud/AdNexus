import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  async createSlot(dto: CreateSlotDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be greater than startTime');
    }

    const campaign = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
    if (!campaign) throw new NotFoundException(`Campaign ${dto.campaignId} not found`);

    const overlapping = await this.schedulesRepo
      .createQueryBuilder('s')
      .where('s.device_id = :deviceId', { deviceId: dto.deviceId })
      .andWhere('s.screen_position = :screen', { screen: dto.screenPosition })
      .andWhere(':start < s.end_time AND :end > s.start_time', {
        start: start.toISOString(),
        end: end.toISOString(),
      })
      .getOne();

    if (overlapping) {
      throw new BadRequestException('Schedule overlap detected for same device/screen');
    }

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
