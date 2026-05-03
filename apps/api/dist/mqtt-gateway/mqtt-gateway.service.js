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
var MqttGatewayService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttGatewayService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mqtt_1 = require("mqtt");
const redis_1 = require("redis");
const devices_service_1 = require("../devices/devices.service");
const live_gateway_1 = require("../websocket-gateway/live.gateway");
let MqttGatewayService = MqttGatewayService_1 = class MqttGatewayService {
    configService;
    devicesService;
    liveGateway;
    logger = new common_1.Logger(MqttGatewayService_1.name);
    client;
    redisClient;
    telemetryCache = new Map();
    constructor(configService, devicesService, liveGateway) {
        this.configService = configService;
        this.devicesService = devicesService;
        this.liveGateway = liveGateway;
    }
    onModuleInit() {
        const redisUrl = this.configService.get('REDIS_URL');
        if (redisUrl) {
            this.redisClient = (0, redis_1.createClient)({ url: redisUrl });
            this.redisClient.on('error', (err) => this.logger.warn(`Redis error: ${String(err)}`));
            void this.redisClient.connect();
        }
        const url = this.configService.get('MQTT_BROKER_URL')
            ?? this.configService.get('MQTT_BROKER')
            ?? 'mqtt://localhost:1883';
        this.client = (0, mqtt_1.connect)(url, {
            username: this.configService.get('MQTT_USERNAME'),
            password: this.configService.get('MQTT_PASSWORD'),
            reconnectPeriod: 5_000,
        });
        this.client.on('connect', () => {
            this.logger.log(`Connected to MQTT broker: ${url}`);
            this.client?.subscribe([
                'adnexus/devices/+/heartbeat',
                'adnexus/devices/+/telemetry',
                'adnexus/devices/+/ack',
            ]);
        });
        this.client.on('message', (topic, payloadBuffer) => {
            const payload = this.safeJsonParse(payloadBuffer.toString());
            if (!payload)
                return;
            if (topic.endsWith('/heartbeat')) {
                const deviceId = this.extractDeviceId(topic);
                if (deviceId) {
                    void this.devicesService.heartbeat(deviceId, payload);
                }
                return;
            }
            if (topic.endsWith('/telemetry')) {
                const deviceId = this.extractDeviceId(topic);
                if (!deviceId)
                    return;
                void this.redisClient?.setEx(`telemetry:${deviceId}`, 300, JSON.stringify(payload));
                this.telemetryCache.set(deviceId, {
                    payload: payload,
                    expiresAt: Date.now() + 5 * 60_000,
                });
                this.liveGateway.emitDeviceTelemetry({ device_id: deviceId, ...payload });
                return;
            }
            if (topic.endsWith('/ack')) {
                this.logger.log(`ACK topic=${topic} payload=${JSON.stringify(payload)}`);
            }
        });
        setInterval(() => this.evictTelemetry(), 10_000);
    }
    onModuleDestroy() {
        this.client?.end(true);
        void this.redisClient?.quit();
    }
    async publishDeviceCommand(deviceId, command, payload) {
        this.publish(`adnexus/devices/${deviceId}/commands`, {
            command,
            payload,
            timestamp: new Date().toISOString(),
        });
    }
    async publishFleetEmergency(payload) {
        this.publish('adnexus/fleet/emergency', {
            ...payload,
            timestamp: new Date().toISOString(),
        });
    }
    getTelemetry(deviceId) {
        const data = this.telemetryCache.get(deviceId);
        if (!data || data.expiresAt < Date.now()) {
            this.telemetryCache.delete(deviceId);
            return null;
        }
        return data.payload;
    }
    publish(topic, payload) {
        if (!this.client)
            return;
        this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
    }
    extractDeviceId(topic) {
        const parts = topic.split('/');
        return parts.length >= 3 ? parts[2] : null;
    }
    safeJsonParse(raw) {
        try {
            return JSON.parse(raw);
        }
        catch {
            this.logger.warn(`Invalid MQTT JSON payload: ${raw}`);
            return null;
        }
    }
    evictTelemetry() {
        const now = Date.now();
        for (const [deviceId, value] of this.telemetryCache.entries()) {
            if (value.expiresAt < now) {
                this.telemetryCache.delete(deviceId);
            }
        }
    }
};
exports.MqttGatewayService = MqttGatewayService;
exports.MqttGatewayService = MqttGatewayService = MqttGatewayService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => devices_service_1.DevicesService))),
    __metadata("design:paramtypes", [config_1.ConfigService,
        devices_service_1.DevicesService,
        live_gateway_1.LiveGateway])
], MqttGatewayService);
//# sourceMappingURL=mqtt-gateway.service.js.map