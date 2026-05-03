import { RegisterDeviceDto } from './dto/register-device.dto';
import { DevicesService } from '../devices/devices.service';
export declare class AuthController {
    private readonly devicesService;
    constructor(devicesService: DevicesService);
    registerDevice(dto: RegisterDeviceDto): Promise<{
        device_id: string;
        serial_number: string;
        access_token: string;
        token_type: string;
    }>;
}
