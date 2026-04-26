export declare enum ScheduleScreenPosition {
    A = "A",
    B = "B",
    C = "C",
    ALL = "ALL"
}
export declare enum PlayMode {
    MIRROR = "MIRROR",
    INDEPENDENT = "INDEPENDENT",
    COMBINED = "COMBINED"
}
export declare class ScheduleEntity {
    id: string;
    campaignId: string;
    deviceId: string;
    screenPosition: ScheduleScreenPosition;
    playMode: PlayMode;
    startTime: Date;
    endTime: Date;
    repeatInterval?: number | null;
    createdAt: Date;
}
