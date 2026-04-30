import { ContentType, ScreenStatus } from '../adnexus.types';
import { UserEntity } from './user.entity';
export declare class ScreenEntity {
    id: string;
    screenId: string;
    name: string;
    evLocation: string;
    uniqueHardwareId: string;
    currentContentUrl: string | null;
    currentContentTitle: string | null;
    currentContentType: ContentType | null;
    status: ScreenStatus;
    currentSeekSeconds: number;
    currentScheduleId: string | null;
    currentSignature: string | null;
    lastSeenAt: Date | null;
    userId: string | null;
    user?: UserEntity | null;
    createdAt: Date;
}
