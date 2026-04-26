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
exports.ScheduleEntity = exports.PlayMode = exports.ScheduleScreenPosition = void 0;
const typeorm_1 = require("typeorm");
var ScheduleScreenPosition;
(function (ScheduleScreenPosition) {
    ScheduleScreenPosition["A"] = "A";
    ScheduleScreenPosition["B"] = "B";
    ScheduleScreenPosition["C"] = "C";
    ScheduleScreenPosition["ALL"] = "ALL";
})(ScheduleScreenPosition || (exports.ScheduleScreenPosition = ScheduleScreenPosition = {}));
var PlayMode;
(function (PlayMode) {
    PlayMode["MIRROR"] = "MIRROR";
    PlayMode["INDEPENDENT"] = "INDEPENDENT";
    PlayMode["COMBINED"] = "COMBINED";
})(PlayMode || (exports.PlayMode = PlayMode = {}));
let ScheduleEntity = class ScheduleEntity {
    id;
    campaignId;
    deviceId;
    screenPosition;
    playMode;
    startTime;
    endTime;
    repeatInterval;
    createdAt;
};
exports.ScheduleEntity = ScheduleEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'campaign_id', type: 'uuid' }),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "campaignId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'device_id', type: 'uuid' }),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "deviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'screen_position',
        type: 'enum',
        enum: ScheduleScreenPosition,
    }),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "screenPosition", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'play_mode', type: 'enum', enum: PlayMode }),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "playMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_time', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ScheduleEntity.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_time', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ScheduleEntity.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'repeat_interval', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], ScheduleEntity.prototype, "repeatInterval", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], ScheduleEntity.prototype, "createdAt", void 0);
exports.ScheduleEntity = ScheduleEntity = __decorate([
    (0, typeorm_1.Entity)('schedules')
], ScheduleEntity);
//# sourceMappingURL=schedule.entity.js.map