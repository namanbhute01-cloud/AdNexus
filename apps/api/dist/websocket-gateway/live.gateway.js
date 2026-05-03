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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
let LiveGateway = class LiveGateway {
    server;
    emitDeviceStatus(payload) {
        this.server.emit('device:status', payload);
    }
    emitDeviceTelemetry(payload) {
        this.server.emit('device:telemetry', payload);
    }
    emitFleetAlert(payload) {
        this.server.emit('fleet:alert', payload);
    }
};
exports.LiveGateway = LiveGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], LiveGateway.prototype, "server", void 0);
exports.LiveGateway = LiveGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        namespace: 'live',
        path: '/api/v1/socket.io',
        cors: {
            origin: '*',
        },
    })
], LiveGateway);
//# sourceMappingURL=live.gateway.js.map