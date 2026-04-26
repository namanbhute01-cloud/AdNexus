import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { DeviceEntity } from '../database/entities/device.entity';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { CommandsController } from './commands.controller';
import { MqttGatewayModule } from '../mqtt-gateway/mqtt-gateway.module';
import { WebsocketGatewayModule } from '../websocket-gateway/websocket-gateway.module';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DeviceEntity]),
    JwtModule,
    forwardRef(() => MqttGatewayModule),
    WebsocketGatewayModule,
    SchedulesModule,
  ],
  controllers: [DevicesController, CommandsController],
  providers: [DevicesService],
  exports: [DevicesService, TypeOrmModule],
})
export class DevicesModule {}
