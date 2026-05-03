import { Repository } from 'typeorm';
import { PlayMode, ScheduleEntity, ScheduleScreenPosition } from '../database/entities/schedule.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { ScreenEntity } from '../database/entities/screen.entity';
import { CreateSlotDto } from './dto/create-slot.dto';
import { MqttGatewayService } from '../mqtt-gateway/mqtt-gateway.service';
export declare class SchedulesService {
    private readonly schedulesRepo;
    private readonly campaignsRepo;
    private readonly screensRepo;
    private readonly mqttGatewayService;
    constructor(schedulesRepo: Repository<ScheduleEntity>, campaignsRepo: Repository<CampaignEntity>, screensRepo: Repository<ScreenEntity>, mqttGatewayService: MqttGatewayService);
    validateSyncScope(screenIds: string[], mode: PlayMode, deviceId: string): Promise<void>;
    checkOverlap(deviceId: string, screenPosition: ScheduleScreenPosition, start: Date, end: Date, excludeId?: string): Promise<void>;
    createSlot(dto: CreateSlotDto): Promise<ScheduleEntity>;
    deleteSlot(id: string): Promise<{
        ok: boolean;
    }>;
    getDeviceSchedule(deviceId: string): Promise<{
        device_id: string;
        generated_at: string;
        screens: Record<string, {
            mode: string;
            slots: unknown[];
        }>;
    }>;
    emergencyOverride(campaignId: string, deviceIds: string[]): Promise<{
        ok: boolean;
        affectedDevices: number;
    }>;
    private toScreenPosition;
}
