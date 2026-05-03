import { Repository } from 'typeorm';
import { ProofOfPlayEntity } from '../database/entities/proof-of-play.entity';
import { ProofOfPlayEventDto } from './dto/proof-of-play-event.dto';
export declare class ProofOfPlayService {
    private readonly popRepo;
    constructor(popRepo: Repository<ProofOfPlayEntity>);
    bulkUpload(deviceId: string, events: ProofOfPlayEventDto[]): Promise<{
        ok: boolean;
        uploaded: number;
    }>;
}
