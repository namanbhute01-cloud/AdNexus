import { IsObject } from 'class-validator';

export class UpdateDisplayInfoDto {
  @IsObject()
  displayInfo!: Record<string, unknown>;
}

