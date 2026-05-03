import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PlaybackMode } from '../adnexus.types';
import { ContentEntity } from './content.entity';
import { UserEntity } from './user.entity';

@Entity('schedules')
export class ScheduleEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'content_id', type: 'uuid' })
  contentId!: string;

  @ManyToOne(() => ContentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content?: ContentEntity;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime!: Date;

  @Column({ name: 'screen_ids', type: 'text', array: true })
  screenIds!: string[];

  @Column({ name: 'ev_location', type: 'varchar' })
  evLocation!: string;

  @Column({ name: 'is_synced_by_ev', type: 'boolean', default: false })
  isSyncedByEV!: boolean;

  @Column({ type: 'enum', enum: PlaybackMode })
  mode!: PlaybackMode;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: UserEntity | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
