import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScreenEntity } from '../database/entities/screen.entity';

@Injectable()
export class ScreensService {
  constructor(
    @InjectRepository(ScreenEntity)
    private readonly screensRepo: Repository<ScreenEntity>,
  ) {}

  async getDeviceScreens(deviceId: string) {
    return this.screensRepo.find({
      where: { deviceId },
      order: { position: 'ASC' },
    });
  }

  async updateDisplayInfo(screenId: string, displayInfo: Record<string, unknown>) {
    const screen = await this.screensRepo.findOne({ where: { id: screenId } });
    if (!screen) {
      throw new NotFoundException(`Screen ${screenId} not found`);
    }
    screen.displayInfo = displayInfo;
    await this.screensRepo.save(screen);
    return screen;
  }

  async updatePassword(screenId: string, passwordHash: string) {
    const screen = await this.screensRepo.findOne({ where: { id: screenId } });
    if (!screen) {
      throw new NotFoundException(`Screen ${screenId} not found`);
    }
    screen.passwordHash = passwordHash;
    await this.screensRepo.save(screen);
    return screen;
  }
}

