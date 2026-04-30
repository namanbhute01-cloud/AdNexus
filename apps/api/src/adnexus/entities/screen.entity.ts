import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ContentType, ScreenStatus } from '../adnexus.types';
import { UserEntity } from './user.entity';

@Entity('adnexus_screens')
export class ScreenEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'screen_id', type: 'varchar', unique: true })
  screenId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ name: 'ev_location', type: 'varchar' })
  evLocation!: string;

  @Column({ name: 'unique_hardware_id', type: 'varchar', unique: true })
  uniqueHardwareId!: string;

  @Column({ name: 'current_content_url', type: 'text', nullable: true })
  currentContentUrl!: string | null;

  @Column({ name: 'current_content_title', type: 'varchar', nullable: true })
  currentContentTitle!: string | null;

  @Column({ name: 'current_content_type', type: 'enum', enum: ContentType, nullable: true })
  currentContentType!: ContentType | null;

  @Column({
    type: 'enum',
    enum: ScreenStatus,
    default: ScreenStatus.Offline,
  })
  status!: ScreenStatus;

  @Column({ name: 'current_seek_seconds', type: 'float', default: 0 })
  currentSeekSeconds!: number;

  @Column({ name: 'current_schedule_id', type: 'uuid', nullable: true })
  currentScheduleId!: string | null;

  @Column({ name: 'current_signature', type: 'varchar', nullable: true })
  currentSignature!: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true, unique: true })
  userId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
