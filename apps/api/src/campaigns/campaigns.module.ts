import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignEntity])],
  providers: [CampaignsService],
  controllers: [CampaignsController],
  exports: [CampaignsService, TypeOrmModule],
})
export class CampaignsModule {}
