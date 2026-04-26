import { ScreensService } from './screens.service';
import { UpdateDisplayInfoDto } from './dto/update-display-info.dto';
export declare class ScreensController {
    private readonly screensService;
    constructor(screensService: ScreensService);
    getDeviceScreens(id: string): Promise<import("../database/entities/screen.entity").ScreenEntity[]>;
    updateDisplayInfo(id: string, dto: UpdateDisplayInfoDto): Promise<import("../database/entities/screen.entity").ScreenEntity>;
}
