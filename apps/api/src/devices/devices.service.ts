import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { DeviceEntity, DeviceStatus } from '../database/entities/device.entity';
import { MqttGatewayService } from '../mqtt-gateway/mqtt-gateway.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { LiveGateway } from '../websocket-gateway/live.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DevicesService implements OnModuleInit {
  private readonly logger = new Logger(DevicesService.name);
  // private staleSweepTimer?: NodeJS.Timeout; // No longer needed with @Cron

  constructor(
    @InjectRepository(DeviceEntity)
    private readonly devicesRepo: Repository<DeviceEntity>,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => MqttGatewayService))
    private readonly mqttGatewayService: MqttGatewayService,
    private readonly liveGateway: LiveGateway,
  ) {}

  onModuleInit(): void {
    // clearInterval(this.staleSweepTimer); // No longer needed with @Cron
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async markOfflineIfStale() {
    const threshold = new Date(Date.now() - 90_000); // 90 seconds
    const updatedResult = await this.devicesRepo.update(
      { lastHeartbeat: LessThan(threshold), status: DeviceStatus.ONLINE },
      { status: DeviceStatus.OFFLINE }
    );

    if (updatedResult.affected && updatedResult.affected > 0) {
      // Fetch the updated devices to emit WebSocket events
      const updatedDevices = await this.devicesRepo.find({
        where: { lastHeartbeat: LessThan(threshold), status: DeviceStatus.OFFLINE },
      });

      updatedDevices.forEach((device) => {
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
    }
    this.logger.log(`Marked ${updatedResult.affected ?? 0} devices offline.`);
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

