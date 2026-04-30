import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PlaybackMode } from '../adnexus.types';

export class CreateScheduleDto {
  @IsString()
  contentId!: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Type(() => String)
  screenIds!: string[];

  @IsOptional()
  @IsString()
  evLocation?: string;

  @IsOptional()
  @IsBoolean()
  isSyncedByEV?: boolean;

  @IsIn([PlaybackMode.Continuous, PlaybackMode.Single])
  mode!: PlaybackMode;
}
