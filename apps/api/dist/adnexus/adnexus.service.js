"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdNexusService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const typeorm_2 = require("typeorm");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
const content_entity_1 = require("./entities/content.entity");
const screen_entity_1 = require("./entities/screen.entity");
const schedule_entity_1 = require("./entities/schedule.entity");
const user_entity_1 = require("./entities/user.entity");
const adnexus_types_1 = require("./adnexus.types");
const password_util_1 = require("./password.util");
const adnexus_gateway_1 = require("./adnexus.gateway");
let AdNexusService = class AdNexusService {
    usersRepo;
    screensRepo;
    contentRepo;
    schedulesRepo;
    jwtService;
    configService;
    gateway;
    uploadsRoot;
    schedulerHandle;
    lastSignatureByScreen = new Map();
    constructor(usersRepo, screensRepo, contentRepo, schedulesRepo, jwtService, configService, gateway) {
        this.usersRepo = usersRepo;
        this.screensRepo = screensRepo;
        this.contentRepo = contentRepo;
        this.schedulesRepo = schedulesRepo;
        this.jwtService = jwtService;
        this.configService = configService;
        this.gateway = gateway;
        this.uploadsRoot = (0, path_1.join)(process.cwd(), 'uploads');
    }
    async onModuleInit() {
        if (!(0, fs_1.existsSync)(this.uploadsRoot)) {
            (0, fs_1.mkdirSync)(this.uploadsRoot, { recursive: true });
        }
        await this.ensureBootstrapAdmin();
        this.schedulerHandle = setInterval(() => {
            void this.runSchedulerTick();
        }, 3_000);
    }
    async ensureBootstrapAdmin() {
        const count = await this.usersRepo.count();
        if (count > 0) {
            return null;
        }
        const username = this.configService.get('ADNEXUS_BOOTSTRAP_ADMIN_USERNAME', 'admin');
        const password = this.configService.get('ADNEXUS_BOOTSTRAP_ADMIN_PASSWORD', 'admin1234');
        const admin = await this.usersRepo.save(this.usersRepo.create({
            username,
            passwordHash: (0, password_util_1.hashPassword)(password),
            role: adnexus_types_1.AdNexusRole.Admin,
        }));
        return admin;
    }
    async loginUser(username, password) {
        const user = await this.usersRepo.findOne({ where: { username } });
        if (!user || user.role === adnexus_types_1.AdNexusRole.Screen) {
            throw new common_1.BadRequestException('Invalid admin or campaigner credentials');
        }
        if (!(0, password_util_1.verifyPassword)(password, user.passwordHash)) {
            throw new common_1.BadRequestException('Invalid admin or campaigner credentials');
        }
        return {
            user: this.publicUser(user),
            token: this.signToken(user),
        };
    }
    async loginScreen(username, password, payload) {
        const user = await this.usersRepo.findOne({ where: { username } });
        if (!user || user.role !== adnexus_types_1.AdNexusRole.Screen) {
            throw new common_1.BadRequestException('Invalid screen credentials');
        }
        if (!(0, password_util_1.verifyPassword)(password, user.passwordHash)) {
            throw new common_1.BadRequestException('Invalid screen credentials');
        }
        const screen = await this.upsertScreenForUser(user, payload);
        screen.status = adnexus_types_1.ScreenStatus.Online;
        screen.lastSeenAt = new Date();
        await this.screensRepo.save(screen);
        const state = await this.resolvePlaybackState(screen.id, new Date());
        return {
            user: this.publicUser(user),
            screen: this.publicScreen(screen),
            token: this.signToken(user, screen),
            state,
        };
    }
    async createUser(dto) {
        const existing = await this.usersRepo.findOne({ where: { username: dto.username } });
        if (existing) {
            throw new common_1.BadRequestException('Username already exists');
        }
        const user = await this.usersRepo.save(this.usersRepo.create({
            username: dto.username,
            passwordHash: (0, password_util_1.hashPassword)(dto.password),
            role: dto.role,
        }));
        if (dto.role === adnexus_types_1.AdNexusRole.Screen) {
            await this.upsertScreenForUser(user, {
                name: dto.screenName ?? dto.username,
                evLocation: dto.evLocation ?? 'EV-Unassigned',
                uniqueHardwareId: dto.uniqueHardwareId ?? `hw-${dto.username}`,
                screenId: dto.screenId ?? `screen-${dto.username}`,
            });
        }
        return this.publicUser(user);
    }
    async listUsers() {
        const users = await this.usersRepo.find({ order: { createdAt: 'DESC' } });
        return users.map((user) => this.publicUser(user));
    }
    async listScreens() {
        const screens = await this.screensRepo.find({
            relations: { user: true },
            order: { evLocation: 'ASC', name: 'ASC' },
        });
        return screens.map((screen) => this.publicScreen(screen));
    }
    async updateScreen(screenId, dto) {
        const screen = await this.screensRepo.findOne({ where: { id: screenId }, relations: { user: true } });
        if (!screen) {
            throw new common_1.NotFoundException(`Screen ${screenId} not found`);
        }
        screen.name = dto.name ?? screen.name;
        screen.evLocation = dto.evLocation ?? screen.evLocation;
        screen.uniqueHardwareId = dto.uniqueHardwareId ?? screen.uniqueHardwareId;
        await this.screensRepo.save(screen);
        return this.publicScreen(screen);
    }
    async uploadContent(file, metadata, ownerId) {
        if (!file) {
            throw new common_1.BadRequestException('Missing file');
        }
        const owner = await this.usersRepo.findOne({ where: { id: ownerId } });
        if (!owner) {
            throw new common_1.NotFoundException(`Owner ${ownerId} not found`);
        }
        const contentId = (0, crypto_1.randomUUID)();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const outputPath = (0, path_1.join)(this.uploadsRoot, contentId);
        (0, fs_1.mkdirSync)(outputPath, { recursive: true });
        const diskPath = (0, path_1.join)(outputPath, safeName);
        await fs_1.promises.writeFile(diskPath, file.buffer);
        const fileUrl = `/uploads/${contentId}/${safeName}`;
        const content = await this.contentRepo.save(this.contentRepo.create({
            id: contentId,
            title: metadata.title,
            fileUrl,
            type: metadata.type,
            ownerId: owner.id,
        }));
        this.gateway.emitAdminSnapshot({ type: 'content:created', content: this.publicContent(content) });
        return this.publicContent(content);
    }
    async listContent() {
        const contents = await this.contentRepo.find({
            relations: { owner: true },
            order: { createdAt: 'DESC' },
        });
        return contents.map((content) => this.publicContent(content));
    }
    async createSchedules(dto, createdById) {
        const content = await this.contentRepo.findOne({ where: { id: dto.contentId } });
        if (!content) {
            throw new common_1.NotFoundException(`Content ${dto.contentId} not found`);
        }
        const requestedScreens = await this.screensRepo.findBy({ id: (0, typeorm_2.In)(dto.screenIds) });
        if (requestedScreens.length === 0) {
            throw new common_1.NotFoundException('No matching screens found');
        }
        const selectedScreens = dto.evLocation
            ? requestedScreens.filter((screen) => screen.evLocation === dto.evLocation)
            : requestedScreens;
        if (selectedScreens.length === 0) {
            throw new common_1.BadRequestException('No screens matched the requested EV location');
        }
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);
        if (endTime <= startTime) {
            throw new common_1.BadRequestException('endTime must be greater than startTime');
        }
        const schedules = selectedScreens.map((screen) => this.schedulesRepo.create({
            id: (0, crypto_1.randomUUID)(),
            contentId: content.id,
            startTime,
            endTime,
            screenIds: [screen.id],
            evLocation: screen.evLocation,
            isSyncedByEV: Boolean(dto.isSyncedByEV),
            mode: dto.mode,
            createdById,
        }));
        await this.schedulesRepo.save(schedules);
        this.gateway.emitAdminSnapshot({ type: 'schedule:created', count: schedules.length });
        return schedules.map((schedule) => this.publicSchedule(schedule));
    }
    async listSchedules() {
        const schedules = await this.schedulesRepo.find({
            relations: { content: true, createdBy: true },
            order: { startTime: 'DESC' },
        });
        return schedules.map((schedule) => this.publicSchedule(schedule));
    }
    async getCampaignerScreens() {
        const screens = await this.screensRepo.find({
            order: { evLocation: 'ASC', name: 'ASC' },
        });
        const states = await Promise.all(screens.map((screen) => this.resolvePlaybackState(screen.id, new Date())));
        return states;
    }
    async getScreenState(screenId) {
        return this.resolvePlaybackState(screenId, new Date());
    }
    async markScreenOnline(screenId) {
        const screen = await this.screensRepo.findOne({ where: { id: screenId } });
        if (!screen) {
            return;
        }
        screen.status = adnexus_types_1.ScreenStatus.Online;
        screen.lastSeenAt = new Date();
        await this.screensRepo.save(screen);
    }
    async markScreenOffline(screenId) {
        const screen = await this.screensRepo.findOne({ where: { id: screenId } });
        if (!screen) {
            return;
        }
        screen.status = adnexus_types_1.ScreenStatus.Offline;
        screen.lastSeenAt = new Date();
        await this.screensRepo.save(screen);
        this.gateway.emitCampaignerSnapshot({
            type: 'screen:offline',
            screenId,
            state: this.publicScreen(screen),
        });
    }
    async runSchedulerTick() {
        const now = new Date();
        const screens = await this.screensRepo.find();
        const activeScreens = new Map();
        const activeSchedules = await this.schedulesRepo
            .createQueryBuilder('schedule')
            .leftJoinAndSelect('schedule.content', 'content')
            .where('schedule.start_time <= :now', { now: now.toISOString() })
            .andWhere('schedule.end_time >= :now', { now: now.toISOString() })
            .orderBy('schedule.start_time', 'ASC')
            .getMany();
        for (const schedule of activeSchedules) {
            for (const screenId of schedule.screenIds) {
                const screen = screens.find((candidate) => candidate.id === screenId);
                if (!screen) {
                    continue;
                }
                const state = this.buildPlaybackState(screen, schedule, now);
                activeScreens.set(screenId, state);
            }
        }
        for (const screen of screens) {
            if (!activeScreens.has(screen.id)) {
                const idleState = this.buildIdleState(screen);
                activeScreens.set(screen.id, idleState);
            }
        }
        const changedScreens = [];
        const snapshot = Array.from(activeScreens.values()).sort((a, b) => a.screenName.localeCompare(b.screenName));
        for (const state of snapshot) {
            const signature = this.signatureFor(state);
            if (this.lastSignatureByScreen.get(state.screenId) === signature) {
                continue;
            }
            this.lastSignatureByScreen.set(state.screenId, signature);
            const screen = screens.find((candidate) => candidate.id === state.screenId);
            if (!screen) {
                continue;
            }
            screen.currentContentUrl = state.currentContentUrl;
            screen.currentContentTitle = state.currentContentTitle;
            screen.currentContentType = state.currentContentType;
            screen.currentScheduleId = state.activeScheduleId;
            screen.currentSeekSeconds = state.seekToSeconds;
            screen.currentSignature = signature;
            changedScreens.push(screen);
            this.gateway.emitScreenPlayback(state.screenId, state);
        }
        if (changedScreens.length > 0) {
            await this.screensRepo.save(changedScreens);
            this.gateway.emitCampaignerSnapshot({
                updatedAt: now.toISOString(),
                screens: snapshot,
            });
        }
    }
    async upsertScreenForUser(user, dto) {
        const nextScreenId = dto.screenId ?? `screen-${user.username}`;
        const nextUniqueHardwareId = dto.uniqueHardwareId ?? `hw-${user.username}`;
        const nextScreenName = dto.name ?? user.username;
        const nextEvLocation = dto.evLocation ?? 'EV-Unassigned';
        let screen = await this.screensRepo.findOne({
            where: [{ userId: user.id }, { screenId: nextScreenId }, { uniqueHardwareId: nextUniqueHardwareId }],
        });
        if (!screen) {
            screen = this.screensRepo.create({
                id: (0, crypto_1.randomUUID)(),
                screenId: nextScreenId,
                uniqueHardwareId: nextUniqueHardwareId,
                name: nextScreenName,
                evLocation: nextEvLocation,
                userId: user.id,
                status: adnexus_types_1.ScreenStatus.Offline,
                currentContentUrl: null,
                currentContentTitle: null,
                currentContentType: null,
                currentSeekSeconds: 0,
                currentScheduleId: null,
                currentSignature: null,
                lastSeenAt: null,
            });
        }
        else {
            screen.userId = user.id;
            if (dto.screenId) {
                screen.screenId = dto.screenId;
            }
            if (dto.uniqueHardwareId) {
                screen.uniqueHardwareId = dto.uniqueHardwareId;
            }
            if (dto.name) {
                screen.name = dto.name;
            }
            if (dto.evLocation) {
                screen.evLocation = dto.evLocation;
            }
        }
        await this.screensRepo.save(screen);
        return screen;
    }
    async resolvePlaybackState(screenId, now) {
        const screen = await this.screensRepo.findOne({ where: { id: screenId } });
        if (!screen) {
            throw new common_1.NotFoundException(`Screen ${screenId} not found`);
        }
        const schedule = await this.schedulesRepo
            .createQueryBuilder('schedule')
            .leftJoinAndSelect('schedule.content', 'content')
            .where(':screenId = ANY(schedule.screen_ids)', { screenId })
            .andWhere('schedule.start_time <= :now', { now: now.toISOString() })
            .andWhere('schedule.end_time >= :now', { now: now.toISOString() })
            .orderBy('schedule.start_time', 'DESC')
            .getOne();
        if (!schedule) {
            return this.buildIdleState(screen);
        }
        return this.buildPlaybackState(screen, schedule, now);
    }
    buildPlaybackState(screen, schedule, now) {
        const content = schedule.content ?? null;
        const seekToSeconds = content?.type === adnexus_types_1.ContentType.Video
            ? Math.max(0, (now.getTime() - schedule.startTime.getTime()) / 1000)
            : 0;
        return {
            screenId: screen.id,
            screenName: screen.name,
            evLocation: screen.evLocation,
            status: screen.status,
            currentContentUrl: content?.fileUrl ?? null,
            currentContentTitle: content?.title ?? null,
            currentContentType: content?.type ?? null,
            activeScheduleId: schedule.id,
            seekToSeconds,
            isSyncedByEV: schedule.isSyncedByEV,
            mode: schedule.mode,
            updatedAt: now.toISOString(),
        };
    }
    buildIdleState(screen) {
        return {
            screenId: screen.id,
            screenName: screen.name,
            evLocation: screen.evLocation,
            status: screen.status,
            currentContentUrl: null,
            currentContentTitle: 'AdNexus Logo',
            currentContentType: null,
            activeScheduleId: null,
            seekToSeconds: 0,
            isSyncedByEV: false,
            mode: null,
            updatedAt: new Date().toISOString(),
        };
    }
    signatureFor(state) {
        return [
            state.currentContentUrl ?? 'idle',
            state.currentContentTitle ?? 'logo',
            state.activeScheduleId ?? 'none',
            Math.floor(state.seekToSeconds).toString(),
            state.status,
            state.mode ?? 'none',
        ].join('|');
    }
    signToken(user, screen) {
        const payload = {
            sub: user.id,
            username: user.username,
            roles: [user.role],
            screenId: screen?.id,
            evLocation: screen?.evLocation,
        };
        return this.jwtService.sign(payload);
    }
    publicUser(user) {
        return {
            id: user.id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
        };
    }
    publicScreen(screen) {
        return {
            id: screen.id,
            screenId: screen.screenId,
            name: screen.name,
            evLocation: screen.evLocation,
            uniqueHardwareId: screen.uniqueHardwareId,
            currentContentUrl: screen.currentContentUrl,
            currentContentTitle: screen.currentContentTitle,
            currentContentType: screen.currentContentType,
            status: screen.status,
            currentSeekSeconds: screen.currentSeekSeconds,
            currentScheduleId: screen.currentScheduleId,
            lastSeenAt: screen.lastSeenAt,
            username: screen.user?.username ?? null,
        };
    }
    publicContent(content) {
        return {
            id: content.id,
            title: content.title,
            fileUrl: content.fileUrl,
            type: content.type,
            ownerId: content.ownerId,
            createdAt: content.createdAt,
        };
    }
    publicSchedule(schedule) {
        return {
            id: schedule.id,
            contentId: schedule.contentId,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            screenIds: schedule.screenIds,
            evLocation: schedule.evLocation,
            isSyncedByEV: schedule.isSyncedByEV,
            mode: schedule.mode,
            createdById: schedule.createdById,
            createdAt: schedule.createdAt,
        };
    }
};
exports.AdNexusService = AdNexusService;
exports.AdNexusService = AdNexusService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.UserEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(screen_entity_1.ScreenEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(content_entity_1.ContentEntity)),
    __param(3, (0, typeorm_1.InjectRepository)(schedule_entity_1.ScheduleEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        config_1.ConfigService,
        adnexus_gateway_1.AdNexusGateway])
], AdNexusService);
//# sourceMappingURL=adnexus.service.js.map