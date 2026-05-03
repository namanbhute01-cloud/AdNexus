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
exports.CreateSlotDto = void 0;
const class_validator_1 = require("class-validator");
const schedule_entity_1 = require("../../database/entities/schedule.entity");
class CreateSlotDto {
    campaignId;
    deviceId;
    screenPosition;
    playMode;
    startTime;
    endTime;
    repeatInterval;
}
exports.CreateSlotDto = CreateSlotDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSlotDto.prototype, "campaignId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateSlotDto.prototype, "deviceId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(schedule_entity_1.ScheduleScreenPosition),
    __metadata("design:type", String)
], CreateSlotDto.prototype, "screenPosition", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(schedule_entity_1.PlayMode),
    __metadata("design:type", String)
], CreateSlotDto.prototype, "playMode", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateSlotDto.prototype, "startTime", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateSlotDto.prototype, "endTime", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], CreateSlotDto.prototype, "repeatInterval", void 0);
//# sourceMappingURL=create-slot.dto.js.map