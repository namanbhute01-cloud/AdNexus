import { ContentType } from '../adnexus.types';
import { UserEntity } from './user.entity';
export declare class ContentEntity {
    id: string;
    title: string;
    fileUrl: string;
    type: ContentType;
    ownerId: string;
    owner?: UserEntity;
    createdAt: Date;
}
