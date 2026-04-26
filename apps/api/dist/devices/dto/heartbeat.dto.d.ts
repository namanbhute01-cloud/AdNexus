export declare class HeartbeatDto {
    timestamp: string;
    status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
    player_status: 'PLAYING' | 'PAUSED' | 'IDLE' | 'ERROR';
    current_campaigns?: Record<string, string>;
}
