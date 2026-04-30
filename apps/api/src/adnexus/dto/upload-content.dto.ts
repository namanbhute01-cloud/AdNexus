import { IsIn, IsOptional, IsString } from 'class-validator';
import { ContentType } from '../adnexus.types';

export class UploadContentDto {
  @IsString()
  title!: string;

  @IsIn([ContentType.Image, ContentType.Video])
  type!: ContentType;

  @IsString()
  ownerId!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
