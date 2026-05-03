import { AdNexusService } from './adnexus.service';
import { AdNexusRole } from './adnexus.types';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UploadContentDto } from './dto/upload-content.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
export declare class AdNexusAuthController {
    private readonly adnexusService;
    constructor(adnexusService: AdNexusService);
    bootstrapAdmin(): Promise<{
        alreadyBootstrapped: boolean;
        ok?: undefined;
    } | {
        ok: boolean;
        alreadyBootstrapped?: undefined;
    }>;
    login(dto: LoginDto): Promise<{
        user: {
            id: string;
            username: string;
            role: AdNexusRole;
            createdAt: Date;
        };
        token: string;
    }>;
    me(req: {
        user: {
            sub: string;
            username: string;
            roles: string[];
            screenId?: string;
            evLocation?: string;
        };
    }): {
        id: string;
        username: string;
        role: string;
        screenId: string | null;
        evLocation: string | null;
    };
}
export declare class AdNexusScreenController {
    private readonly adnexusService;
    constructor(adnexusService: AdNexusService);
    loginScreen(dto: LoginDto & {
        screenId?: string;
        evLocation?: string;
        uniqueHardwareId?: string;
        name?: string;
    }): Promise<{
        user: {
            id: string;
            username: string;
            role: AdNexusRole;
            createdAt: Date;
        };
        screen: {
            id: string;
            screenId: string;
            name: string;
            evLocation: string;
            uniqueHardwareId: string;
            currentContentUrl: string | null;
            currentContentTitle: string | null;
            currentContentType: import("./adnexus.types").ContentType | null;
            status: import("./adnexus.types").ScreenStatus;
            currentSeekSeconds: number;
            currentScheduleId: string | null;
            lastSeenAt: Date | null;
            username: string | null;
        };
        token: string;
        state: import("./adnexus.types").ScreenPlaybackState;
    }>;
    me(req: {
        user: {
            sub: string;
            username: string;
            roles: string[];
            screenId?: string;
            evLocation?: string;
        };
    }): {
        id: string;
        username: string;
        role: string;
        screenId: string | null;
        evLocation: string | null;
    };
    state(req: {
        user: {
            screenId?: string;
        };
    }): Promise<import("./adnexus.types").ScreenPlaybackState> | null;
}
export declare class AdNexusAdminController {
    private readonly adnexusService;
    constructor(adnexusService: AdNexusService);
    createUser(dto: CreateUserDto): Promise<{
        id: string;
        username: string;
        role: AdNexusRole;
        createdAt: Date;
    }>;
    listUsers(): Promise<{
        id: string;
        username: string;
        role: AdNexusRole;
        createdAt: Date;
    }[]>;
    listScreens(): Promise<{
        id: string;
        screenId: string;
        name: string;
        evLocation: string;
        uniqueHardwareId: string;
        currentContentUrl: string | null;
        currentContentTitle: string | null;
        currentContentType: import("./adnexus.types").ContentType | null;
        status: import("./adnexus.types").ScreenStatus;
        currentSeekSeconds: number;
        currentScheduleId: string | null;
        lastSeenAt: Date | null;
        username: string | null;
    }[]>;
    updateScreen(id: string, dto: UpdateScreenDto): Promise<{
        id: string;
        screenId: string;
        name: string;
        evLocation: string;
        uniqueHardwareId: string;
        currentContentUrl: string | null;
        currentContentTitle: string | null;
        currentContentType: import("./adnexus.types").ContentType | null;
        status: import("./adnexus.types").ScreenStatus;
        currentSeekSeconds: number;
        currentScheduleId: string | null;
        lastSeenAt: Date | null;
        username: string | null;
    }>;
    uploadContent(file: Express.Multer.File, dto: UploadContentDto & {
        ownerId?: string;
    }, req: {
        user: {
            sub?: string;
            username?: string;
        };
    }): Promise<{
        id: string;
        title: string;
        fileUrl: string;
        type: import("./adnexus.types").ContentType;
        ownerId: string;
        createdAt: Date;
    }>;
    listContent(): Promise<{
        id: string;
        title: string;
        fileUrl: string;
        type: import("./adnexus.types").ContentType;
        ownerId: string;
        createdAt: Date;
    }[]>;
    createSchedule(dto: CreateScheduleDto, req: {
        user: {
            sub?: string;
        };
    }): Promise<{
        id: string;
        contentId: string;
        startTime: Date;
        endTime: Date;
        screenIds: string[];
        evLocation: string;
        isSyncedByEV: boolean;
        mode: import("./adnexus.types").PlaybackMode;
        createdById: string | null;
        createdAt: Date;
    }[]>;
    listSchedule(): Promise<{
        id: string;
        contentId: string;
        startTime: Date;
        endTime: Date;
        screenIds: string[];
        evLocation: string;
        isSyncedByEV: boolean;
        mode: import("./adnexus.types").PlaybackMode;
        createdById: string | null;
        createdAt: Date;
    }[]>;
}
export declare class AdNexusCampaignerController {
    private readonly adnexusService;
    constructor(adnexusService: AdNexusService);
    screens(): Promise<import("./adnexus.types").ScreenPlaybackState[]>;
}
