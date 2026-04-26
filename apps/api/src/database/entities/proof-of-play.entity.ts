import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('proof_of_play')
export class ProofOfPlayEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId!: string;

  @Column({ name: 'screen_id', type: 'uuid' })
  screenId!: string;

  @Column({ name: 'campaign_id', type: 'uuid' })
  campaignId!: string;

  @Column({ name: 'played_at', type: 'timestamptz' })
  playedAt!: Date;

  @Column({ name: 'duration_played_seconds', type: 'int' })
  durationPlayedSeconds!: number;

  @Column({ name: 'uploaded_at', type: 'timestamptz', nullable: true })
  uploadedAt?: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

