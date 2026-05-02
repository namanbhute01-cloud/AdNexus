import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { ScreensModule } from './screens/screens.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ProofOfPlayModule } from './proof-of-play/proof-of-play.module';
import { MqttGatewayModule } from './mqtt-gateway/mqtt-gateway.module';
import { WebsocketGatewayModule } from './websocket-gateway/websocket-gateway.module';
import { AdNexusModule } from './adnexus/adnexus.module';
import { RolesGuard } from './auth/roles.guard';
import { OrganizationEntity } from './database/entities/organization.entity';
import { DeviceEntity } from './database/entities/device.entity';
import { ScreenEntity } from './database/entities/screen.entity';
import { CampaignEntity } from './database/entities/campaign.entity';
import { ScheduleEntity } from './database/entities/schedule.entity';
import { ProofOfPlayEntity } from './database/entities/proof-of-play.entity';
import { UserEntity as AdNexusUserEntity } from './adnexus/entities/user.entity';
import { ScreenEntity as AdNexusScreenEntity } from './adnexus/entities/screen.entity';
import { ContentEntity as AdNexusContentEntity } from './adnexus/entities/content.entity';
import { ScheduleEntity as AdNexusScheduleEntity } from './adnexus/entities/schedule.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USER', 'adnexus'),
        password: configService.get<string>('DB_PASSWORD', 'dev_password'),
        database: configService.get<string>('DB_NAME', 'adnexus'),
        autoLoadEntities: true,
        synchronize: false,
        entities: [
          OrganizationEntity,
          DeviceEntity,
          ScreenEntity,
          CampaignEntity,
          ScheduleEntity,
          ProofOfPlayEntity,
          AdNexusUserEntity,
          AdNexusScreenEntity,
          AdNexusContentEntity,
          AdNexusScheduleEntity,
        ],
      }),
    }),
    AuthModule,
    DevicesModule,
    ScreensModule,
    CampaignsModule,
    SchedulesModule,
    ProofOfPlayModule,
    MqttGatewayModule,
    WebsocketGatewayModule,
    AdNexusModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
