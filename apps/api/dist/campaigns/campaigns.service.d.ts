import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { UploadCampaignDto } from './dto/upload-campaign.dto';
export declare class CampaignsService {
    private readonly campaignsRepo;
    private readonly configService;
    private readonly s3;
    private readonly bucket;
    private readonly cdnDomain;
    constructor(campaignsRepo: Repository<CampaignEntity>, configService: ConfigService);
    uploadCampaign(file: Express.Multer.File, metadata: UploadCampaignDto): Promise<CampaignEntity>;
    getDownloadUrl(campaignId: string): Promise<{
        downloadUrl: string;
        expiresInSeconds: number;
    }>;
    validateChecksum(campaignId: string, hash: string): Promise<{
        valid: boolean;
    }>;
    private generateThumbnail;
}
