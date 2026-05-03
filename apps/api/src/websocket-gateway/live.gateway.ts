import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  namespace: 'live',
  path: '/api/v1/socket.io',
  cors: {
    origin: '*',
  },
})
export class LiveGateway {
  @WebSocketServer()
  server!: Server;

  emitDeviceStatus(payload: Record<string, unknown>) {
    this.server.emit('device:status', payload);
  }

  emitDeviceTelemetry(payload: Record<string, unknown>) {
    this.server.emit('device:telemetry', payload);
  }

  emitFleetAlert(payload: Record<string, unknown>) {
    this.server.emit('fleet:alert', payload);
  }
}

