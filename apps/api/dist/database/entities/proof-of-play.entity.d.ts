export declare class ProofOfPlayEntity {
    id: string;
    deviceId: string;
    screenId: string;
    campaignId: string;
    playedAt: Date;
    durationPlayedSeconds: number;
    uploadedAt?: Date | null;
    createdAt: Date;
}
