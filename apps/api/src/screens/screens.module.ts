import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScreenEntity } from '../database/entities/screen.entity';
import { ScreensService } from './screens.service';
import { ScreensController } from './screens.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScreenEntity])],
  providers: [ScreensService],
  controllers: [ScreensController],
  exports: [ScreensService, TypeOrmModule],
})
export class ScreensModule {}
