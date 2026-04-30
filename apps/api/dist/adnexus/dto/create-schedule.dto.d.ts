import { PlaybackMode } from '../adnexus.types';
export declare class CreateScheduleDto {
    contentId: string;
    startTime: string;
    endTime: string;
    screenIds: string[];
    evLocation?: string;
    isSyncedByEV?: boolean;
    mode: PlaybackMode;
}
