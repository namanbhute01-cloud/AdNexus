import { IsIn, IsISO8601, IsObject, IsOptional, IsString } from 'class-validator';

export class HeartbeatDto {
  @IsISO8601()
  timestamp!: string;

  @IsString()
  @IsIn(['ONLINE', 'OFFLINE', 'MAINTENANCE'])
  status!: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';

  @IsString()
  @IsIn(['PLAYING', 'PAUSED', 'IDLE', 'ERROR'])
  player_status!: 'PLAYING' | 'PAUSED' | 'IDLE' | 'ERROR';

  @IsObject()
  @IsOptional()
  current_campaigns?: Record<string, string>;
}

