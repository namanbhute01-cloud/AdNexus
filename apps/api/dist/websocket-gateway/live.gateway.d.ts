import { Server } from 'socket.io';
export declare class LiveGateway {
    server: Server;
    emitDeviceStatus(payload: Record<string, unknown>): void;
    emitDeviceTelemetry(payload: Record<string, unknown>): void;
    emitFleetAlert(payload: Record<string, unknown>): void;
}
