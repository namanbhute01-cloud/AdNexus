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
exports.AdNexusGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("typeorm");
const typeorm_2 = require("@nestjs/typeorm");
const socket_io_1 = require("socket.io");
const adnexus_types_1 = require("./adnexus.types");
const screen_entity_1 = require("./entities/screen.entity");
let AdNexusGateway = class AdNexusGateway {
    jwtService;
    screensRepo;
    server;
    constructor(jwtService, screensRepo) {
        this.jwtService = jwtService;
        this.screensRepo = screensRepo;
    }
    async handleConnection(client) {
        const token = this.extractToken(client);
        if (!token) {
            client.disconnect(true);
            return;
        }
        try {
            const payload = this.jwtService.verify(token);
            client.data.jwt = payload;
            client.join(`role:${payload.roles[0]}`);
            if (payload.screenId) {
                client.join(`screen:${payload.screenId}`);
                const screen = await this.screensRepo.findOne({ where: { id: payload.screenId } });
                if (screen) {
                    screen.status = adnexus_types_1.ScreenStatus.Online;
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
        }
        catch {
            client.disconnect(true);
        }
    }
    async handleDisconnect(client) {
        const payload = client.data.jwt;
        if (!payload?.screenId) {
            return;
        }
        const screen = await this.screensRepo.findOne({ where: { id: payload.screenId } });
        if (!screen) {
            return;
        }
        screen.status = adnexus_types_1.ScreenStatus.Offline;
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
    emitScreenPlayback(screenId, payload) {
        if (!this.server) {
            return;
        }
        this.server.to(`screen:${screenId}`).emit('screen:update', payload);
    }
    emitCampaignerSnapshot(payload) {
        if (!this.server) {
            return;
        }
        this.server.to('role:campaigner').emit('campaigner:screens', payload);
    }
    emitAdminSnapshot(payload) {
        if (!this.server) {
            return;
        }
        this.server.to('role:admin').emit('admin:refresh', payload);
    }
    emitPlaybackChange(payload) {
        if (!this.server) {
            return;
        }
        this.server.emit('adnexus:playback', payload);
    }
    extractToken(client) {
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
};
exports.AdNexusGateway = AdNexusGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], AdNexusGateway.prototype, "server", void 0);
exports.AdNexusGateway = AdNexusGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: '/adnexus',
        cors: {
            origin: '*',
        },
    }),
    __param(1, (0, typeorm_2.InjectRepository)(screen_entity_1.ScreenEntity)),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        typeorm_1.Repository])
], AdNexusGateway);
//# sourceMappingURL=adnexus.gateway.js.map