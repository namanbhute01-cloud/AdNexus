import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export enum ScreenPosition {
  A = 'A',
  B = 'B',
  C = 'C',
}

@Entity('screens')
export class ScreenEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @Column({ name: 'sub_serial', type: 'varchar', unique: true })
  subSerial!: string;

  @Column({ type: 'enum', enum: ScreenPosition })
  position!: ScreenPosition;

  @Column({ name: 'display_info', type: 'jsonb', nullable: true })
  displayInfo?: Record<string, unknown> | null;

  @Column({ name: 'current_campaign_id', type: 'uuid', nullable: true })
  currentCampaignId?: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

