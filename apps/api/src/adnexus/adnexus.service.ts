import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { In, Repository } from 'typeorm';
import { existsSync, mkdirSync, promises as fsPromises } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ContentEntity } from './entities/content.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UploadContentDto } from './dto/upload-content.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';
import { ScreenEntity } from './entities/screen.entity';
import { ScheduleEntity } from './entities/schedule.entity';
import { UserEntity } from './entities/user.entity';
import {
  AdNexusRole,
  ContentType,
  JwtPayload,
  PlaybackMode,
  ScreenPlaybackState,
  ScreenStatus,
} from './adnexus.types';
import { hashPassword, verifyPassword } from './password.util';
import { AdNexusGateway } from './adnexus.gateway';

@Injectable()
export class AdNexusService implements OnModuleInit {
  private readonly uploadsRoot: string;
  private schedulerHandle?: NodeJS.Timeout;
  private lastSignatureByScreen = new Map<string, string>();

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(ScreenEntity)
    private readonly screensRepo: Repository<ScreenEntity>,
    @InjectRepository(ContentEntity)
    private readonly contentRepo: Repository<ContentEntity>,
    @InjectRepository(ScheduleEntity)
    private readonly schedulesRepo: Repository<ScheduleEntity>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly gateway: AdNexusGateway,
  ) {
    this.uploadsRoot = join(process.cwd(), 'uploads');
  }

  async onModuleInit(): Promise<void> {
    if (!existsSync(this.uploadsRoot)) {
      mkdirSync(this.uploadsRoot, { recursive: true });
    }
    await this.ensureBootstrapAdmin();
    this.schedulerHandle = setInterval(() => {
      void this.runSchedulerTick();
    }, 3_000);
  }

  async ensureBootstrapAdmin(): Promise<UserEntity | null> {
    const count = await this.usersRepo.count();
    if (count > 0) {
      return null;
    }

    const username = this.configService.get<string>('ADNEXUS_BOOTSTRAP_ADMIN_USERNAME', 'admin');
    const password = this.configService.get<string>('ADNEXUS_BOOTSTRAP_ADMIN_PASSWORD', 'admin1234');
    const admin = await this.usersRepo.save(
      this.usersRepo.create({
        username,
        passwordHash: hashPassword(password),
        role: AdNexusRole.Admin,
      }),
    );
    return admin;
  }

  async loginUser(username: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { username } });
    if (!user || user.role === AdNexusRole.Screen) {
      throw new BadRequestException('Invalid admin or campaigner credentials');
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new BadRequestException('Invalid admin or campaigner credentials');
    }

    return {
      user: this.publicUser(user),
      token: this.signToken(user),
    };
  }

  async loginScreen(username: string, password: string, payload: { screenId?: string; evLocation?: string; uniqueHardwareId?: string; name?: string; }) {
    const user = await this.usersRepo.findOne({ where: { username } });
    if (!user || user.role !== AdNexusRole.Screen) {
      throw new BadRequestException('Invalid screen credentials');
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new BadRequestException('Invalid screen credentials');
    }

    const screen = await this.upsertScreenForUser(user, payload);
    screen.status = ScreenStatus.Online;
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

  async createUser(dto: CreateUserDto) {
    const existing = await this.usersRepo.findOne({ where: { username: dto.username } });
    if (existing) {
      throw new BadRequestException('Username already exists');
    }

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        username: dto.username,
        passwordHash: hashPassword(dto.password),
        role: dto.role,
      }),
    );

    if (dto.role === AdNexusRole.Screen) {
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

  async updateScreen(screenId: string, dto: UpdateScreenDto) {
    const screen = await this.screensRepo.findOne({ where: { id: screenId }, relations: { user: true } });
    if (!screen) {
      throw new NotFoundException(`Screen ${screenId} not found`);
    }

    screen.name = dto.name ?? screen.name;
    screen.evLocation = dto.evLocation ?? screen.evLocation;
    screen.uniqueHardwareId = dto.uniqueHardwareId ?? screen.uniqueHardwareId;
    await this.screensRepo.save(screen);
    return this.publicScreen(screen);
  }

  async uploadContent(file: Express.Multer.File, metadata: UploadContentDto, ownerId: string) {
    if (!file) {
      throw new BadRequestException('Missing file');
    }

    const owner = await this.usersRepo.findOne({ where: { id: ownerId } });
    if (!owner) {
      throw new NotFoundException(`Owner ${ownerId} not found`);
    }

    const contentId = randomUUID();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const outputPath = join(this.uploadsRoot, contentId);
    mkdirSync(outputPath, { recursive: true });
    const diskPath = join(outputPath, safeName);
    await fsPromises.writeFile(diskPath, file.buffer);

    const fileUrl = `/uploads/${contentId}/${safeName}`;
    const content = await this.contentRepo.save(
      this.contentRepo.create({
        id: contentId,
        title: metadata.title,
        fileUrl,
        type: metadata.type,
        ownerId: owner.id,
      }),
    );
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

  async createSchedules(dto: CreateScheduleDto, createdById: string) {
    const content = await this.contentRepo.findOne({ where: { id: dto.contentId } });
    if (!content) {
      throw new NotFoundException(`Content ${dto.contentId} not found`);
    }

    const requestedScreens = await this.screensRepo.findBy({ id: In(dto.screenIds) });
    if (requestedScreens.length === 0) {
      throw new NotFoundException('No matching screens found');
    }

    const selectedScreens = dto.evLocation
      ? requestedScreens.filter((screen) => screen.evLocation === dto.evLocation)
      : requestedScreens;

    if (selectedScreens.length === 0) {
      throw new BadRequestException('No screens matched the requested EV location');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be greater than startTime');
    }

    const schedules = selectedScreens.map((screen) =>
      this.schedulesRepo.create({
        id: randomUUID(),
        contentId: content.id,
        startTime,
        endTime,
        screenIds: [screen.id],
        evLocation: screen.evLocation,
        isSyncedByEV: Boolean(dto.isSyncedByEV),
        mode: dto.mode,
        createdById,
      }),
    );

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

  async getScreenState(screenId: string) {
    return this.resolvePlaybackState(screenId, new Date());
  }

  async markScreenOnline(screenId: string): Promise<void> {
    const screen = await this.screensRepo.findOne({ where: { id: screenId } });
    if (!screen) {
      return;
    }
    screen.status = ScreenStatus.Online;
    screen.lastSeenAt = new Date();
    await this.screensRepo.save(screen);
  }

  async markScreenOffline(screenId: string): Promise<void> {
    const screen = await this.screensRepo.findOne({ where: { id: screenId } });
    if (!screen) {
      return;
    }
    screen.status = ScreenStatus.Offline;
    screen.lastSeenAt = new Date();
    await this.screensRepo.save(screen);
    this.gateway.emitCampaignerSnapshot({
      type: 'screen:offline',
      screenId,
      state: this.publicScreen(screen),
    });
  }

  async runSchedulerTick(): Promise<void> {
    const now = new Date();
    const screens = await this.screensRepo.find();
    const activeScreens = new Map<string, ScreenPlaybackState>();
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

    const changedScreens: ScreenEntity[] = [];
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

  private async upsertScreenForUser(
    user: UserEntity,
    dto: { screenId?: string; evLocation?: string; uniqueHardwareId?: string; name?: string },
  ) {
    const nextScreenId = dto.screenId ?? `screen-${user.username}`;
    const nextUniqueHardwareId = dto.uniqueHardwareId ?? `hw-${user.username}`;
    const nextScreenName = dto.name ?? user.username;
    const nextEvLocation = dto.evLocation ?? 'EV-Unassigned';

    let screen = await this.screensRepo.findOne({
      where: [{ userId: user.id }, { screenId: nextScreenId }, { uniqueHardwareId: nextUniqueHardwareId }],
    });

    if (!screen) {
      screen = this.screensRepo.create({
        id: randomUUID(),
        screenId: nextScreenId,
        uniqueHardwareId: nextUniqueHardwareId,
        name: nextScreenName,
        evLocation: nextEvLocation,
        userId: user.id,
        status: ScreenStatus.Offline,
        currentContentUrl: null,
        currentContentTitle: null,
        currentContentType: null,
        currentSeekSeconds: 0,
        currentScheduleId: null,
        currentSignature: null,
        lastSeenAt: null,
      });
    } else {
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

  private async resolvePlaybackState(screenId: string, now: Date): Promise<ScreenPlaybackState> {
    const screen = await this.screensRepo.findOne({ where: { id: screenId } });
    if (!screen) {
      throw new NotFoundException(`Screen ${screenId} not found`);
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

  private buildPlaybackState(
    screen: ScreenEntity,
    schedule: ScheduleEntity & { content?: ContentEntity },
    now: Date,
  ): ScreenPlaybackState {
    const content = schedule.content ?? null;
    const seekToSeconds =
      content?.type === ContentType.Video
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

  private buildIdleState(screen: ScreenEntity): ScreenPlaybackState {
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

  private signatureFor(state: ScreenPlaybackState): string {
    return [
      state.currentContentUrl ?? 'idle',
      state.currentContentTitle ?? 'logo',
      state.activeScheduleId ?? 'none',
      Math.floor(state.seekToSeconds).toString(),
      state.status,
      state.mode ?? 'none',
    ].join('|');
  }

  private signToken(user: UserEntity, screen?: ScreenEntity) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      roles: [user.role],
      screenId: screen?.id,
      evLocation: screen?.evLocation,
    };
    return this.jwtService.sign(payload);
  }

  private publicUser(user: UserEntity) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private publicScreen(screen: ScreenEntity) {
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

  private publicContent(content: ContentEntity) {
    return {
      id: content.id,
      title: content.title,
      fileUrl: content.fileUrl,
      type: content.type,
      ownerId: content.ownerId,
      createdAt: content.createdAt,
    };
  }

  private publicSchedule(schedule: ScheduleEntity) {
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
}
