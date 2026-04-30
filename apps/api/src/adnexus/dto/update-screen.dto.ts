import { IsOptional, IsString } from 'class-validator';

export class UpdateScreenDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  evLocation?: string;

  @IsOptional()
  @IsString()
  uniqueHardwareId?: string;
}
