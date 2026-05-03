import { DevicesService } from './devices.service';
import { SendCommandDto } from './dto/send-command.dto';
import { SchedulesService } from '../schedules/schedules.service';
export declare class CommandsController {
    private readonly devicesService;
    private readonly schedulesService;
    constructor(devicesService: DevicesService, schedulesService: SchedulesService);
    restartDevice(id: string): Promise<{
        ok: boolean;
    }>;
    skipCurrent(id: string): Promise<{
        ok: boolean;
    }>;
    sendDeviceCommand(id: string, dto: SendCommandDto): Promise<{
        ok: boolean;
    }>;
    emergencyOverride(body: {
        campaignId: string;
        deviceIds?: string[];
    }): Promise<{
        ok: boolean;
        affectedDevices: number;
    }>;
}
