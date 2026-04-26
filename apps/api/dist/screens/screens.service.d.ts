import { Repository } from 'typeorm';
import { ScreenEntity } from '../database/entities/screen.entity';
export declare class ScreensService {
    private readonly screensRepo;
    constructor(screensRepo: Repository<ScreenEntity>);
    getDeviceScreens(deviceId: string): Promise<ScreenEntity[]>;
    updateDisplayInfo(screenId: string, displayInfo: Record<string, unknown>): Promise<ScreenEntity>;
}
