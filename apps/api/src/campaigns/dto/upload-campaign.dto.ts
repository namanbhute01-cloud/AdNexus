import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UploadCampaignDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  durationSeconds!: number;

  @IsString()
  @IsOptional()
  resolution?: string;

  @IsInt()
  @IsOptional()
  priority?: number;
}

