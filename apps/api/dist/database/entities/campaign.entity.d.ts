export declare class CampaignEntity {
    id: string;
    organizationId: string;
    name: string;
    mediaUrl: string;
    mediaChecksum: string;
    durationSeconds: number;
    resolution?: string | null;
    priority: number;
    createdAt: Date;
}
