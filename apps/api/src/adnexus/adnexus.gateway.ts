import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { JwtPayload, ScreenStatus } from './adnexus.types';
import { ScreenEntity } from './entities/screen.entity';

@WebSocketGateway({
  namespace: '/adnexus',
  cors: {
    origin: '*',
  },
})
export class AdNexusGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(ScreenEntity)
    private readonly screensRepo: Repository<ScreenEntity>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      client.data.jwt = payload;
      client.join(`role:${payload.roles[0]}`);
      if (payload.screenId) {
        client.join(`screen:${payload.screenId}`);
        const screen = await this.screensRepo.findOne({ where: { id: payload.screenId } });
        if (screen) {
          screen.status = ScreenStatus.Online;
          screen.lastSeenAt = new Date();
          await this.screensRepo.save(screen);
          this.server?.to('role:campaigner').emit('campaigner:screens:refresh', {
            screenId: screen.id,
            state: {
              screenId: screen.id,
              screenName: screen.name,
              evLocation: screen.evLocation,
              status: screen.status,
              currentContentUrl: screen.currentContentUrl,
              currentContentTitle: screen.currentContentTitle,
              currentContentType: screen.currentContentType,
              activeScheduleId: screen.currentScheduleId,
              seekToSeconds: screen.currentSeekSeconds,
              isSyncedByEV: false,
              mode: null,
              updatedAt: screen.lastSeenAt.toISOString(),
            },
          });
        }
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const payload = client.data.jwt as JwtPayload | undefined;
    if (!payload?.screenId) {
      return;
    }

    const screen = await this.screensRepo.findOne({ where: { id: payload.screenId } });
    if (!screen) {
      return;
    }
    screen.status = ScreenStatus.Offline;
    screen.lastSeenAt = new Date();
    await this.screensRepo.save(screen);
    this.server.to('role:campaigner').emit('campaigner:screens:refresh', {
      screenId: screen.id,
      state: {
        screenId: screen.id,
        screenName: screen.name,
        evLocation: screen.evLocation,
        status: screen.status,
        currentContentUrl: screen.currentContentUrl,
        currentContentTitle: screen.currentContentTitle,
        currentContentType: screen.currentContentType,
        activeScheduleId: screen.currentScheduleId,
        seekToSeconds: screen.currentSeekSeconds,
        isSyncedByEV: false,
        mode: null,
        updatedAt: screen.lastSeenAt.toISOString(),
      },
    });
  }

  emitScreenPlayback(screenId: string, payload: Record<string, unknown>): void {
    if (!this.server) {
      return;
    }
    this.server.to(`screen:${screenId}`).emit('screen:update', payload);
  }

  emitCampaignerSnapshot(payload: Record<string, unknown>): void {
    if (!this.server) {
      return;
    }
    this.server.to('role:campaigner').emit('campaigner:screens', payload);
  }

  emitAdminSnapshot(payload: Record<string, unknown>): void {
    if (!this.server) {
      return;
    }
    this.server.to('role:admin').emit('admin:refresh', payload);
  }

  emitPlaybackChange(payload: Record<string, unknown>): void {
    if (!this.server) {
      return;
    }
    this.server.emit('adnexus:playback', payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }

    const tokenQuery = client.handshake.query.token;
    return typeof tokenQuery === 'string' ? tokenQuery : null;
  }
}
