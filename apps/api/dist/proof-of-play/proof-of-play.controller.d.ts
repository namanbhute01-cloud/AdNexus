import { ProofOfPlayService } from './proof-of-play.service';
import { ProofOfPlayEventDto } from './dto/proof-of-play-event.dto';
export declare class ProofOfPlayController {
    private readonly proofOfPlayService;
    constructor(proofOfPlayService: ProofOfPlayService);
    upload(id: string, events: ProofOfPlayEventDto[]): Promise<{
        ok: boolean;
        uploaded: number;
    }>;
}
