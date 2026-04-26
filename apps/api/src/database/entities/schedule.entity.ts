import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export enum ScheduleScreenPosition {
  A = 'A',
  B = 'B',
  C = 'C',
  ALL = 'ALL',
}

export enum PlayMode {
  MIRROR = 'MIRROR',
  INDEPENDENT = 'INDEPENDENT',
  COMBINED = 'COMBINED',
}

@Entity('schedules')
export class ScheduleEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @Column({
    name: 'screen_position',
    type: 'enum',
    enum: ScheduleScreenPosition,
  })
  screenPosition!: ScheduleScreenPosition;

  @Column({ name: 'play_mode', type: 'enum', enum: PlayMode })
  playMode!: PlayMode;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime!: Date;

  @Column({ name: 'repeat_interval', type: 'int', nullable: true })
  repeatInterval?: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

