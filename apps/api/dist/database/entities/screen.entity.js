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
exports.ScreenEntity = exports.ScreenPosition = void 0;
const typeorm_1 = require("typeorm");
var ScreenPosition;
(function (ScreenPosition) {
    ScreenPosition["A"] = "A";
    ScreenPosition["B"] = "B";
    ScreenPosition["C"] = "C";
})(ScreenPosition || (exports.ScreenPosition = ScreenPosition = {}));
let ScreenEntity = class ScreenEntity {
    id;
    deviceId;
    subSerial;
    position;
    displayInfo;
    currentCampaignId;
    createdAt;
};
exports.ScreenEntity = ScreenEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], ScreenEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'device_id', type: 'uuid' }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "deviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sub_serial', type: 'varchar', unique: true }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "subSerial", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ScreenPosition }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'display_info', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "displayInfo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_campaign_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "currentCampaignId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], ScreenEntity.prototype, "createdAt", void 0);
exports.ScreenEntity = ScreenEntity = __decorate([
    (0, typeorm_1.Entity)('screens')
], ScreenEntity);
//# sourceMappingURL=screen.entity.js.map