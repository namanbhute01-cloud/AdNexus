import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID } from 'class-validator';
import { PlayMode, ScheduleScreenPosition } from '../../database/entities/schedule.entity';

export class CreateSlotDto {
  @IsUUID()
  campaignId!: string;

  @IsUUID()
  deviceId!: string;

  @IsEnum(ScheduleScreenPosition)
  screenPosition!: ScheduleScreenPosition;

  @IsEnum(PlayMode)
  playMode!: PlayMode;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsInt()
  @IsOptional()
  repeatInterval?: number;
}

