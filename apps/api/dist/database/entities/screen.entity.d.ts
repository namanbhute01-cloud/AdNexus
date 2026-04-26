export declare enum ScreenPosition {
    A = "A",
    B = "B",
    C = "C"
}
export declare class ScreenEntity {
    id: string;
    deviceId: string;
    subSerial: string;
    position: ScreenPosition;
    displayInfo?: Record<string, unknown> | null;
    currentCampaignId?: string | null;
    createdAt: Date;
}
