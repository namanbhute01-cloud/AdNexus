import { AdNexusRole } from '../adnexus.types';
export declare class CreateUserDto {
    username: string;
    password: string;
    role: AdNexusRole;
    screenName?: string;
    evLocation?: string;
    uniqueHardwareId?: string;
    screenId?: string;
}
