import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  JoinColumn,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';

export enum DeviceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  MAINTENANCE = 'MAINTENANCE',
}

@Entity('devices')
export class DeviceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'serial_number', type: 'varchar', unique: true })
  serialNumber!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @Column({
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.OFFLINE,
  })
  status!: DeviceStatus;

  @Column({ name: 'last_heartbeat', type: 'timestamptz', nullable: true })
  lastHeartbeat?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  location?: Record<string, unknown> | null;

  @Column({ name: 'firmware_version', type: 'varchar', nullable: true })
  firmwareVersion?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

