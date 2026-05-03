import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { DeviceEntity } from '../database/entities/device.entity';
import { MqttGatewayService } from '../mqtt-gateway/mqtt-gateway.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { LiveGateway } from '../websocket-gateway/live.gateway';
export declare class DevicesService implements OnModuleInit {
    private readonly devicesRepo;
    private readonly jwtService;
    private readonly mqttGatewayService;
    private readonly liveGateway;
    private readonly logger;
    constructor(devicesRepo: Repository<DeviceEntity>, jwtService: JwtService, mqttGatewayService: MqttGatewayService, liveGateway: LiveGateway);
    onModuleInit(): void;
    markOfflineIfStale(): Promise<void>;
    registerDevice(serial: string, organizationId: string, _cert: string): Promise<{
        device_id: string;
        serial_number: string;
        access_token: string;
        token_type: string;
    }>;
    heartbeat(deviceId: string, payload: HeartbeatDto): Promise<{
        ok: boolean;
    }>;
    sendCommand(deviceId: string, command: string, payload?: Record<string, unknown>): Promise<{
        ok: boolean;
    }>;
    findOne(deviceId: string): Promise<DeviceEntity>;
}
