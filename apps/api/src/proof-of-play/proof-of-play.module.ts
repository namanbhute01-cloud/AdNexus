import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProofOfPlayEntity } from '../database/entities/proof-of-play.entity';
import { ProofOfPlayService } from './proof-of-play.service';
import { ProofOfPlayController } from './proof-of-play.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProofOfPlayEntity])],
  providers: [ProofOfPlayService],
  controllers: [ProofOfPlayController],
})
export class ProofOfPlayModule {}
