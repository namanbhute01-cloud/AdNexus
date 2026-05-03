import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevicesService } from '../devices/devices.service';
import { LiveGateway } from '../websocket-gateway/live.gateway';
export declare class MqttGatewayService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly devicesService;
    private readonly liveGateway;
    private readonly logger;
    private client?;
    private redisClient?;
    private readonly telemetryCache;
    constructor(configService: ConfigService, devicesService: DevicesService, liveGateway: LiveGateway);
    onModuleInit(): void;
    onModuleDestroy(): void;
    publishDeviceCommand(deviceId: string, command: string, payload: Record<string, unknown>): Promise<void>;
    publishFleetEmergency(payload: Record<string, unknown>): Promise<void>;
    getTelemetry(deviceId: string): Record<string, unknown> | null;
    private publish;
    private extractDeviceId;
    private safeJsonParse;
    private evictTelemetry;
}
