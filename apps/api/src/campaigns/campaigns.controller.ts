import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { UploadCampaignDto } from './dto/upload-campaign.dto';

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadCampaign(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadCampaignDto) {
    return this.campaignsService.uploadCampaign(file, dto);
  }

  @Get(':id/download-url')
  getDownloadUrl(@Param('id') id: string) {
    return this.campaignsService.getDownloadUrl(id);
  }

  @Post(':id/validate-checksum')
  validateChecksum(@Param('id') id: string, @Body() body: { hash: string }) {
    return this.campaignsService.validateChecksum(id, body.hash);
  }
}

