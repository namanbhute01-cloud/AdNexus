import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AdNexusGateway } from './adnexus.gateway';
import { AdNexusService } from './adnexus.service';
import { AdNexusAdminController, AdNexusAuthController, AdNexusCampaignerController, AdNexusScreenController } from './adnexus.controller';
import { UserEntity } from './entities/user.entity';
import { ScreenEntity } from './entities/screen.entity';
import { ContentEntity } from './entities/content.entity';
import { ScheduleEntity } from './entities/schedule.entity';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([UserEntity, ScreenEntity, ContentEntity, ScheduleEntity])],
  providers: [AdNexusService, AdNexusGateway],
  controllers: [AdNexusAuthController, AdNexusScreenController, AdNexusAdminController, AdNexusCampaignerController],
  exports: [AdNexusService, AdNexusGateway],
})
export class AdNexusModule {}
