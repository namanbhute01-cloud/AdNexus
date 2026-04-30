import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AdNexusRole } from '../adnexus.types';

export class CreateUserDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsIn([AdNexusRole.Admin, AdNexusRole.Campaigner, AdNexusRole.Screen])
  role!: AdNexusRole;

  @IsOptional()
  @IsString()
  screenName?: string;

  @IsOptional()
  @IsString()
  evLocation?: string;

  @IsOptional()
  @IsString()
  uniqueHardwareId?: string;

  @IsOptional()
  @IsString()
  screenId?: string;
}
