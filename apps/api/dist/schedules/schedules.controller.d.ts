import { SchedulesService } from './schedules.service';
import { CreateSlotDto } from './dto/create-slot.dto';
export declare class SchedulesController {
    private readonly schedulesService;
    constructor(schedulesService: SchedulesService);
    create(dto: CreateSlotDto): Promise<import("../database/entities/schedule.entity").ScheduleEntity>;
    delete(id: string): Promise<{
        ok: boolean;
    }>;
    getDeviceSchedule(id: string): Promise<{
        device_id: string;
        generated_at: string;
        screens: Record<string, {
            mode: string;
            slots: unknown[];
        }>;
    }>;
}
