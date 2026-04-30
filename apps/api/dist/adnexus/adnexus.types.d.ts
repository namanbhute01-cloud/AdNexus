export declare enum AdNexusRole {
    Admin = "admin",
    Campaigner = "campaigner",
    Screen = "screen"
}
export declare enum ScreenStatus {
    Online = "online",
    Offline = "offline"
}
export declare enum ContentType {
    Image = "image",
    Video = "video"
}
export declare enum PlaybackMode {
    Continuous = "Continuous",
    Single = "Single"
}
export type JwtPayload = {
    sub: string;
    username: string;
    roles: AdNexusRole[];
    screenId?: string;
    evLocation?: string;
};
export type ScreenPlaybackState = {
    screenId: string;
    screenName: string;
    evLocation: string;
    status: ScreenStatus;
    currentContentUrl: string | null;
    currentContentTitle: string | null;
    currentContentType: ContentType | null;
    activeScheduleId: string | null;
    seekToSeconds: number;
    isSyncedByEV: boolean;
    mode: PlaybackMode | null;
    updatedAt: string;
};
