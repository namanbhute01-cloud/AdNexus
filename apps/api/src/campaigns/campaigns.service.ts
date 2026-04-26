import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { S3 } from 'aws-sdk';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { UploadCampaignDto } from './dto/upload-campaign.dto';

@Injectable()
export class CampaignsService {
  private readonly s3: S3;
  private readonly bucket: string;
  private readonly cdnDomain: string;

  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaignsRepo: Repository<CampaignEntity>,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', '');
    this.cdnDomain = this.configService.get<string>('AWS_CLOUDFRONT_DOMAIN', '');
    this.s3 = new S3({
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      region: this.configService.get<string>('AWS_REGION', 'ap-south-1'),
      signatureVersion: 'v4',
    });
  }

  async uploadCampaign(file: Express.Multer.File, metadata: UploadCampaignDto) {
    if (!file) {
      throw new NotFoundException('Missing campaign file');
    }

    const id = randomUUID();
    const ext = path.extname(file.originalname) || '.bin';
    const key = `campaigns/${id}/asset${ext}`;
    const checksum = `sha256:${createHash('sha256').update(file.buffer).digest('hex')}`;

    let mediaUrl = `local:///${key}`;
    if (this.bucket) {
      await this.s3
        .putObject({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        })
        .promise();
      mediaUrl = this.cdnDomain ? `https://${this.cdnDomain}/${key}` : `s3://${this.bucket}/${key}`;
    }

    const campaign = this.campaignsRepo.create({
      id,
      organizationId: metadata.organizationId,
      name: metadata.name,
      mediaUrl,
      mediaChecksum: checksum,
      durationSeconds: metadata.durationSeconds,
      resolution: metadata.resolution,
      priority: metadata.priority ?? 0,
    });
    await this.campaignsRepo.save(campaign);

    await this.generateThumbnail(file.buffer, id);
    return campaign;
  }

  async getDownloadUrl(campaignId: string) {
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    if (!this.bucket || !campaign.mediaUrl.includes('/campaigns/')) {
      return { downloadUrl: campaign.mediaUrl, expiresInSeconds: 900 };
    }

    const key = campaign.mediaUrl.split(`https://${this.cdnDomain}/`)[1];
    const downloadUrl = this.s3.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: 900,
    });
    return { downloadUrl, expiresInSeconds: 900 };
  }

  async validateChecksum(campaignId: string, hash: string) {
    const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
    if (!campaign) {
      throw new NotFoundException(`Campaign ${campaignId} not found`);
    }
    return { valid: campaign.mediaChecksum === hash };
  }

  private async generateThumbnail(buffer: Buffer, campaignId: string): Promise<void> {
    const tmpFile = path.join(os.tmpdir(), `${campaignId}.upload`);
    const thumbFile = path.join(os.tmpdir(), `${campaignId}.thumb.jpg`);
    try {
      fs.writeFileSync(tmpFile, buffer);
      // Placeholder implementation for Phase 1 scaffold.
      fs.writeFileSync(thumbFile, '');
    } catch {
      // Thumbnail generation is best-effort in this scaffold.
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      if (fs.existsSync(thumbFile)) fs.unlinkSync(thumbFile);
    }
  }
}

