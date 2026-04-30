import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { ScreenEntity } from './entities/screen.entity';
export declare class AdNexusGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly jwtService;
    private readonly screensRepo;
    server: Server;
    constructor(jwtService: JwtService, screensRepo: Repository<ScreenEntity>);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    emitScreenPlayback(screenId: string, payload: Record<string, unknown>): void;
    emitCampaignerSnapshot(payload: Record<string, unknown>): void;
    emitAdminSnapshot(payload: Record<string, unknown>): void;
    emitPlaybackChange(payload: Record<string, unknown>): void;
    private extractToken;
}
