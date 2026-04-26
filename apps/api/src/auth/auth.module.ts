import { forwardRef, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { DevicesModule } from '../devices/devices.module';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DeviceCertGuard } from './device-cert.guard';
import { RolesGuard } from './roles.guard';
import { DeviceCertMiddleware } from './device-cert.middleware';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev_secret_change_in_prod'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRY', '15m') as unknown as number,
        },
      }),
    }),
    forwardRef(() => DevicesModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, DeviceCertGuard, RolesGuard],
  exports: [JwtModule, JwtAuthGuard, DeviceCertGuard, RolesGuard, AuthService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(DeviceCertMiddleware).forRoutes('auth/register-device');
    consumer.apply(DeviceCertMiddleware).forRoutes('devices/*');
    consumer.apply(DeviceCertMiddleware).forRoutes('screens/*');
  }
}
