import { PlaybackMode } from '../adnexus.types';
import { ContentEntity } from './content.entity';
import { UserEntity } from './user.entity';
export declare class ScheduleEntity {
    id: string;
    contentId: string;
    content?: ContentEntity;
    startTime: Date;
    endTime: Date;
    screenIds: string[];
    evLocation: string;
    isSyncedByEV: boolean;
    mode: PlaybackMode;
    createdById: string | null;
    createdBy?: UserEntity | null;
    createdAt: Date;
}
