import { CampaignsService } from './campaigns.service';
import { UploadCampaignDto } from './dto/upload-campaign.dto';
export declare class CampaignsController {
    private readonly campaignsService;
    constructor(campaignsService: CampaignsService);
    uploadCampaign(file: Express.Multer.File, dto: UploadCampaignDto): Promise<import("../database/entities/campaign.entity").CampaignEntity>;
    getDownloadUrl(id: string): Promise<{
        downloadUrl: string;
        expiresInSeconds: number;
    }>;
    validateChecksum(id: string, body: {
        hash: string;
    }): Promise<{
        valid: boolean;
    }>;
}
