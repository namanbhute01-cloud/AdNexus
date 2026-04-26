import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, MqttClient } from 'mqtt';
import { createClient, RedisClientType } from 'redis';
import { DevicesService } from '../devices/devices.service';
import { LiveGateway } from '../websocket-gateway/live.gateway';

type CachedTelemetry = {
  payload: Record<string, unknown>;
  expiresAt: number;
};

@Injectable()
export class MqttGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttGatewayService.name);
  private client?: MqttClient;
  private redisClient?: RedisClientType;
  private readonly telemetryCache = new Map<string, CachedTelemetry>();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
    private readonly liveGateway: LiveGateway,
  ) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redisClient = createClient({ url: redisUrl });
      this.redisClient.on('error', (err) => this.logger.warn(`Redis error: ${String(err)}`));
      void this.redisClient.connect();
    }

    const url = this.configService.get<string>('MQTT_BROKER_URL')
      ?? this.configService.get<string>('MQTT_BROKER')
      ?? 'mqtt://localhost:1883';

    this.client = connect(url, {
      username: this.configService.get<string>('MQTT_USERNAME'),
      password: this.configService.get<string>('MQTT_PASSWORD'),
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
      if (!payload) return;

      if (topic.endsWith('/heartbeat')) {
        const deviceId = this.extractDeviceId(topic);
        if (deviceId) {
          void this.devicesService.heartbeat(deviceId, payload as never);
        }
        return;
      }

      if (topic.endsWith('/telemetry')) {
        const deviceId = this.extractDeviceId(topic);
        if (!deviceId) return;
        void this.redisClient?.setEx(
          `telemetry:${deviceId}`,
          300,
          JSON.stringify(payload as Record<string, unknown>),
        );
        this.telemetryCache.set(deviceId, {
          payload: payload as Record<string, unknown>,
          expiresAt: Date.now() + 5 * 60_000,
        });
        this.liveGateway.emitDeviceTelemetry({ device_id: deviceId, ...(payload as object) });
        return;
      }

      if (topic.endsWith('/ack')) {
        this.logger.log(`ACK topic=${topic} payload=${JSON.stringify(payload)}`);
      }
    });

    setInterval(() => this.evictTelemetry(), 10_000);
  }

  onModuleDestroy(): void {
    this.client?.end(true);
    void this.redisClient?.quit();
  }

  async publishDeviceCommand(deviceId: string, command: string, payload: Record<string, unknown>) {
    this.publish(`adnexus/devices/${deviceId}/commands`, {
      command,
      payload,
      timestamp: new Date().toISOString(),
    });
  }

  async publishFleetEmergency(payload: Record<string, unknown>) {
    this.publish('adnexus/fleet/emergency', {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  getTelemetry(deviceId: string): Record<string, unknown> | null {
    const data = this.telemetryCache.get(deviceId);
    if (!data || data.expiresAt < Date.now()) {
      this.telemetryCache.delete(deviceId);
      return null;
    }
    return data.payload;
  }

  private publish(topic: string, payload: Record<string, unknown>) {
    if (!this.client) return;
    this.client.publish(topic, JSON.stringify(payload), { qos: 1 });
  }

  private extractDeviceId(topic: string): string | null {
    const parts = topic.split('/');
    return parts.length >= 3 ? parts[2] : null;
  }

  private safeJsonParse(raw: string): object | null {
    try {
      return JSON.parse(raw) as object;
    } catch {
      this.logger.warn(`Invalid MQTT JSON payload: ${raw}`);
      return null;
    }
  }

  private evictTelemetry() {
    const now = Date.now();
    for (const [deviceId, value] of this.telemetryCache.entries()) {
      if (value.expiresAt < now) {
        this.telemetryCache.delete(deviceId);
      }
    }
  }
}
