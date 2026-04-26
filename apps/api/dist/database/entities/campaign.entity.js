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
exports.CampaignEntity = void 0;
const typeorm_1 = require("typeorm");
let CampaignEntity = class CampaignEntity {
    id;
    organizationId;
    name;
    mediaUrl;
    mediaChecksum;
    durationSeconds;
    resolution;
    priority;
    createdAt;
};
exports.CampaignEntity = CampaignEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], CampaignEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], CampaignEntity.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], CampaignEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'media_url', type: 'text' }),
    __metadata("design:type", String)
], CampaignEntity.prototype, "mediaUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'media_checksum', type: 'varchar' }),
    __metadata("design:type", String)
], CampaignEntity.prototype, "mediaChecksum", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'duration_seconds', type: 'int' }),
    __metadata("design:type", Number)
], CampaignEntity.prototype, "durationSeconds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], CampaignEntity.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], CampaignEntity.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], CampaignEntity.prototype, "createdAt", void 0);
exports.CampaignEntity = CampaignEntity = __decorate([
    (0, typeorm_1.Entity)('campaigns')
], CampaignEntity);
//# sourceMappingURL=campaign.entity.js.map