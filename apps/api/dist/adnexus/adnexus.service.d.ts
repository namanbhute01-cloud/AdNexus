import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { ContentEntity } from './entities/content.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UploadContentDto } from './dto/upload-content.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { ScreenEntity } from './entities/screen.entity';
import { ScheduleEntity } from './entities/schedule.entity';
import { UserEntity } from './entities/user.entity';
import { AdNexusRole, ContentType, PlaybackMode, ScreenPlaybackState, ScreenStatus } from './adnexus.types';
import { AdNexusGateway } from './adnexus.gateway';
export declare class AdNexusService implements OnModuleInit {
    private readonly usersRepo;
    private readonly screensRepo;
    private readonly contentRepo;
    private readonly schedulesRepo;
    private readonly jwtService;
    private readonly configService;
    private readonly gateway;
    private readonly uploadsRoot;
    private schedulerHandle?;
    private lastSignatureByScreen;
    constructor(usersRepo: Repository<UserEntity>, screensRepo: Repository<ScreenEntity>, contentRepo: Repository<ContentEntity>, schedulesRepo: Repository<ScheduleEntity>, jwtService: JwtService, configService: ConfigService, gateway: AdNexusGateway);
    onModuleInit(): Promise<void>;
    ensureBootstrapAdmin(): Promise<UserEntity | null>;
    loginUser(username: string, password: string): Promise<{
        user: {
            id: string;
            username: string;
            role: AdNexusRole;
            createdAt: Date;
        };
        token: string;
    }>;
    loginScreen(username: string, password: string, payload: {
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
            currentContentType: ContentType | null;
            status: ScreenStatus;
            currentSeekSeconds: number;
            currentScheduleId: string | null;
            lastSeenAt: Date | null;
            username: string | null;
        };
        token: string;
        state: ScreenPlaybackState;
    }>;
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
        currentContentType: ContentType | null;
        status: ScreenStatus;
        currentSeekSeconds: number;
        currentScheduleId: string | null;
        lastSeenAt: Date | null;
        username: string | null;
    }[]>;
    updateScreen(screenId: string, dto: UpdateScreenDto): Promise<{
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
        lastSeenAt: Date | null;
        username: string | null;
    }>;
    uploadContent(file: Express.Multer.File, metadata: UploadContentDto, ownerId: string): Promise<{
        id: string;
        title: string;
        fileUrl: string;
        type: ContentType;
        ownerId: string;
        createdAt: Date;
    }>;
    listContent(): Promise<{
        id: string;
        title: string;
        fileUrl: string;
        type: ContentType;
        ownerId: string;
        createdAt: Date;
    }[]>;
    createSchedules(dto: CreateScheduleDto, createdById: string): Promise<{
        id: string;
        contentId: string;
        startTime: Date;
        endTime: Date;
        screenIds: string[];
        evLocation: string;
        isSyncedByEV: boolean;
        mode: PlaybackMode;
        createdById: string | null;
        createdAt: Date;
    }[]>;
    listSchedules(): Promise<{
        id: string;
        contentId: string;
        startTime: Date;
        endTime: Date;
        screenIds: string[];
        evLocation: string;
        isSyncedByEV: boolean;
        mode: PlaybackMode;
        createdById: string | null;
        createdAt: Date;
    }[]>;
    getCampaignerScreens(): Promise<ScreenPlaybackState[]>;
    getScreenState(screenId: string): Promise<ScreenPlaybackState>;
    markScreenOnline(screenId: string): Promise<void>;
    markScreenOffline(screenId: string): Promise<void>;
    runSchedulerTick(): Promise<void>;
    private upsertScreenForUser;
    private resolvePlaybackState;
    private buildPlaybackState;
    private buildIdleState;
    private signatureFor;
    private signToken;
    private publicUser;
    private publicScreen;
    private publicContent;
    private publicSchedule;
}
