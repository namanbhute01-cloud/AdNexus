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
var DevicesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const crypto_1 = require("crypto");
const device_entity_1 = require("../database/entities/device.entity");
const mqtt_gateway_service_1 = require("../mqtt-gateway/mqtt-gateway.service");
const live_gateway_1 = require("../websocket-gateway/live.gateway");
let DevicesService = DevicesService_1 = class DevicesService {
    devicesRepo;
    jwtService;
    mqttGatewayService;
    liveGateway;
    logger = new common_1.Logger(DevicesService_1.name);
    staleSweepTimer;
    constructor(devicesRepo, jwtService, mqttGatewayService, liveGateway) {
        this.devicesRepo = devicesRepo;
        this.jwtService = jwtService;
        this.mqttGatewayService = mqttGatewayService;
        this.liveGateway = liveGateway;
    }
    onModuleInit() {
        this.staleSweepTimer = setInterval(() => {
            void this.markOfflineIfStale();
        }, 60_000);
    }
    async registerDevice(serial, organizationId, _cert) {
        let device = await this.devicesRepo.findOne({ where: { serialNumber: serial } });
        if (!device) {
            device = this.devicesRepo.create({
                id: (0, crypto_1.randomUUID)(),
                serialNumber: serial,
                organizationId,
                status: device_entity_1.DeviceStatus.OFFLINE,
            });
            await this.devicesRepo.save(device);
        }
        const accessToken = this.jwtService.sign({
            sub: device.id,
            serial_number: device.serialNumber,
            roles: ['device'],
        });
        return {
            device_id: device.id,
            serial_number: device.serialNumber,
            access_token: accessToken,
            token_type: 'Bearer',
        };
    }
    async heartbeat(deviceId, payload) {
        const device = await this.devicesRepo.findOne({ where: { id: deviceId } });
        if (!device) {
            throw new common_1.NotFoundException(`Device ${deviceId} not found`);
        }
        device.lastHeartbeat = new Date(payload.timestamp);
        device.status = device_entity_1.DeviceStatus.ONLINE;
        await this.devicesRepo.save(device);
        this.liveGateway.emitDeviceStatus({
            device_id: device.id,
            status: device.status,
            last_heartbeat: device.lastHeartbeat,
        });
        return { ok: true };
    }
    async markOfflineIfStale() {
        const staleCutoff = new Date(Date.now() - 90_000);
        const staleDevices = await this.devicesRepo
            .createQueryBuilder('d')
            .where('d.last_heartbeat IS NULL OR d.last_heartbeat < :cutoff', { cutoff: staleCutoff })
            .andWhere('d.status <> :offline', { offline: device_entity_1.DeviceStatus.OFFLINE })
            .getMany();
        if (staleDevices.length === 0) {
            return { updated: 0 };
        }
        for (const device of staleDevices) {
            device.status = device_entity_1.DeviceStatus.OFFLINE;
        }
        await this.devicesRepo.save(staleDevices);
        staleDevices.forEach((device) => {
            this.liveGateway.emitDeviceStatus({
                device_id: device.id,
                status: device_entity_1.DeviceStatus.OFFLINE,
                last_heartbeat: device.lastHeartbeat ?? null,
            });
            this.liveGateway.emitFleetAlert({
                type: 'HEARTBEAT_MISSED',
                device_id: device.id,
                serial_number: device.serialNumber,
            });
        });
        return { updated: staleDevices.length };
    }
    async sendCommand(deviceId, command, payload = {}) {
        const device = await this.devicesRepo.findOne({ where: { id: deviceId } });
        if (!device) {
            throw new common_1.NotFoundException(`Device ${deviceId} not found`);
        }
        await this.mqttGatewayService.publishDeviceCommand(deviceId, command, payload);
        this.logger.log(`Command ${command} sent to ${device.serialNumber}`);
        return { ok: true };
    }
    async findOne(deviceId) {
        const device = await this.devicesRepo.findOne({ where: { id: deviceId } });
        if (!device) {
            throw new common_1.NotFoundException(`Device ${deviceId} not found`);
        }
        return device;
    }
};
exports.DevicesService = DevicesService;
exports.DevicesService = DevicesService = DevicesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(device_entity_1.DeviceEntity)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => mqtt_gateway_service_1.MqttGatewayService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService,
        mqtt_gateway_service_1.MqttGatewayService,
        live_gateway_1.LiveGateway])
], DevicesService);
//# sourceMappingURL=devices.service.js.map