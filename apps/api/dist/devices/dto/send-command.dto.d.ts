export declare class SendCommandDto {
    command: 'RESTART' | 'SKIP_AD' | 'SET_VOLUME' | 'EMERGENCY_OVERRIDE' | 'UPDATE_SCHEDULE';
    payload?: Record<string, unknown>;
}
