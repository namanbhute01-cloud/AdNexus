import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('campaigns')
export class CampaignEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ name: 'media_url', type: 'text' })
  mediaUrl!: string;

  @Column({ name: 'media_checksum', type: 'varchar' })
  mediaChecksum!: string;

  @Column({ name: 'duration_seconds', type: 'int' })
  durationSeconds!: number;

  @Column({ type: 'varchar', nullable: true })
  resolution?: string | null;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

