import { DevicesService } from './devices.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
export declare class DevicesController {
    private readonly devicesService;
    constructor(devicesService: DevicesService);
    heartbeat(id: string, dto: HeartbeatDto): Promise<{
        ok: boolean;
    }>;
    markOfflineIfStale(): Promise<void>;
}
