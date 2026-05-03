import { PlayMode, ScheduleScreenPosition } from '../../database/entities/schedule.entity';
export declare class CreateSlotDto {
    campaignId: string;
    deviceId: string;
    screenPosition: ScheduleScreenPosition;
    playMode: PlayMode;
    startTime: string;
    endTime: string;
    repeatInterval?: number;
}
