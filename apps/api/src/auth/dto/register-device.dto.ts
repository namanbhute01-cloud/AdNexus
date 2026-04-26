import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  serial!: string;

  @IsUUID()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  cert!: string;
}

