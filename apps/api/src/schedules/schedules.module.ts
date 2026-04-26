import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleEntity } from '../database/entities/schedule.entity';
import { CampaignEntity } from '../database/entities/campaign.entity';
import { ScreenEntity } from '../database/entities/screen.entity';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { MqttGatewayModule } from '../mqtt-gateway/mqtt-gateway.module';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleEntity, CampaignEntity, ScreenEntity]), MqttGatewayModule],
  providers: [SchedulesService],
  controllers: [SchedulesController],
  exports: [SchedulesService, TypeOrmModule],
})
export class SchedulesModule {}
