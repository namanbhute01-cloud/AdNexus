import { forwardRef, Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { MqttGatewayService } from './mqtt-gateway.service';
import { WebsocketGatewayModule } from '../websocket-gateway/websocket-gateway.module';

@Module({
  imports: [forwardRef(() => DevicesModule), WebsocketGatewayModule],
  providers: [MqttGatewayService],
  exports: [MqttGatewayService],
})
export class MqttGatewayModule {}
