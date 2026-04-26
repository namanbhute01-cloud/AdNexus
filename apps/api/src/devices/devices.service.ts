import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { DeviceEntity, DeviceStatus } from '../database/entities/device.entity';
import { MqttGatewayService } from '../mqtt-gateway/mqtt-gateway.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { LiveGateway } from '../websocket-gateway/live.gateway';

@Injectable()
export class DevicesService implements OnModuleInit {
  private readonly logger = new Logger(DevicesService.name);
  private staleSweepTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly devicesRepo: Repository<DeviceEntity>,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => MqttGatewayService))
    private readonly mqttGatewayService: MqttGatewayService,
    private readonly liveGateway: LiveGateway,
  ) {}

  onModuleInit(): void {
    this.staleSweepTimer = setInterval(() => {
      void this.markOfflineIfStale();
    }, 60_000);
  }

  async registerDevice(serial: string, organizationId: string, _cert: string) {
    let device = await this.devicesRepo.findOne({ where: { serialNumber: serial } });
    if (!device) {
      device = this.devicesRepo.create({
        id: randomUUID(),
        serialNumber: serial,
        organizationId,
        status: DeviceStatus.OFFLINE,
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

  async heartbeat(deviceId: string, payload: HeartbeatDto) {
    const device = await this.devicesRepo.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }
    device.lastHeartbeat = new Date(payload.timestamp);
    device.status = DeviceStatus.ONLINE;
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
      .andWhere('d.status <> :offline', { offline: DeviceStatus.OFFLINE })
      .getMany();

    if (staleDevices.length === 0) {
      return { updated: 0 };
    }

    for (const device of staleDevices) {
      device.status = DeviceStatus.OFFLINE;
    }
    await this.devicesRepo.save(staleDevices);

    staleDevices.forEach((device) => {
      this.liveGateway.emitDeviceStatus({
        device_id: device.id,
        status: DeviceStatus.OFFLINE,
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

  async sendCommand(deviceId: string, command: string, payload: Record<string, unknown> = {}) {
    const device = await this.devicesRepo.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }
    await this.mqttGatewayService.publishDeviceCommand(deviceId, command, payload);
    this.logger.log(`Command ${command} sent to ${device.serialNumber}`);
    return { ok: true };
  }

  async findOne(deviceId: string) {
    const device = await this.devicesRepo.findOne({ where: { id: deviceId } });
    if (!device) {
      throw new NotFoundException(`Device ${deviceId} not found`);
    }
    return device;
  }
}

