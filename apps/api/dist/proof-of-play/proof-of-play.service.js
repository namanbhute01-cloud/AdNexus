"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProofOfPlayService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const proof_of_play_entity_1 = require("../database/entities/proof-of-play.entity");
let ProofOfPlayService = class ProofOfPlayService {
    popRepo;
    constructor(popRepo) {
        this.popRepo = popRepo;
    }
    async bulkUpload(deviceId, events) {
        const rows = events.map((event) => this.popRepo.create({
            id: (0, crypto_1.randomUUID)(),
            deviceId,
            screenId: event.screen_id,
            campaignId: event.campaign_id,
            playedAt: new Date(event.played_at),
            durationPlayedSeconds: event.duration_played_seconds,
            uploadedAt: new Date(),
        }));
        if (rows.length > 0) {
            await this.popRepo.save(rows);
        }
        return { ok: true, uploaded: rows.length };
    }
};
exports.ProofOfPlayService = ProofOfPlayService;
exports.ProofOfPlayService = ProofOfPlayService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(proof_of_play_entity_1.ProofOfPlayEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProofOfPlayService);
//# sourceMappingURL=proof-of-play.service.js.map