import { AdNexusRole } from '../adnexus.types';
export declare class UserEntity {
    id: string;
    username: string;
    passwordHash: string;
    role: AdNexusRole;
    createdAt: Date;
}
