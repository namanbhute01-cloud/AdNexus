import { OrganizationEntity } from './organization.entity';
export declare enum DeviceStatus {
    ONLINE = "ONLINE",
    OFFLINE = "OFFLINE",
    MAINTENANCE = "MAINTENANCE"
}
export declare class DeviceEntity {
    id: string;
    serialNumber: string;
    organizationId: string;
    organization?: OrganizationEntity;
    status: DeviceStatus;
    lastHeartbeat?: Date | null;
    location?: Record<string, unknown> | null;
    firmwareVersion?: string | null;
    createdAt: Date;
}
