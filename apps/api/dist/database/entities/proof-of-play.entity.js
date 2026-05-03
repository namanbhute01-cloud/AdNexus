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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProofOfPlayEntity = void 0;
const typeorm_1 = require("typeorm");
let ProofOfPlayEntity = class ProofOfPlayEntity {
    id;
    deviceId;
    screenId;
    campaignId;
    playedAt;
    durationPlayedSeconds;
    uploadedAt;
    createdAt;
};
exports.ProofOfPlayEntity = ProofOfPlayEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], ProofOfPlayEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'device_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProofOfPlayEntity.prototype, "deviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'screen_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProofOfPlayEntity.prototype, "screenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'campaign_id', type: 'uuid' }),
    __metadata("design:type", String)
], ProofOfPlayEntity.prototype, "campaignId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'played_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ProofOfPlayEntity.prototype, "playedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'duration_played_seconds', type: 'int' }),
    __metadata("design:type", Number)
], ProofOfPlayEntity.prototype, "durationPlayedSeconds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'uploaded_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ProofOfPlayEntity.prototype, "uploadedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], ProofOfPlayEntity.prototype, "createdAt", void 0);
exports.ProofOfPlayEntity = ProofOfPlayEntity = __decorate([
    (0, typeorm_1.Entity)('proof_of_play')
], ProofOfPlayEntity);
//# sourceMappingURL=proof-of-play.entity.js.map