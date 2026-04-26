import { IsDateString, IsInt, IsUUID, Min } from 'class-validator';

export class ProofOfPlayEventDto {
  @IsUUID()
  screen_id!: string;

  @IsUUID()
  campaign_id!: string;

  @IsDateString()
  played_at!: string;

  @IsInt()
  @Min(1)
  duration_played_seconds!: number;
}

