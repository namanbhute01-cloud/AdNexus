import { IsIn, IsObject, IsOptional } from 'class-validator';

export class SendCommandDto {
  @IsIn(['RESTART', 'SKIP_AD', 'SET_VOLUME', 'EMERGENCY_OVERRIDE', 'UPDATE_SCHEDULE'])
  command!: 'RESTART' | 'SKIP_AD' | 'SET_VOLUME' | 'EMERGENCY_OVERRIDE' | 'UPDATE_SCHEDULE';

  @IsObject()
  @IsOptional()
  payload?: Record<string, unknown>;
}

