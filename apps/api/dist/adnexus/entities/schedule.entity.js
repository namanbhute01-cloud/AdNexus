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
exports.ScheduleEntity = void 0;
const typeorm_1 = require("typeorm");
const adnexus_types_1 = require("../adnexus.types");
const content_entity_1 = require("./content.entity");
const user_entity_1 = require("./user.entity");
let ScheduleEntity = class ScheduleEntity {
    id;
    contentId;
    content;
    startTime;
    endTime;
    screenIds;
    evLocation;
    isSyncedByEV;
    mode;
    createdById;
    createdBy;
    createdAt;
};
exports.ScheduleEntity = ScheduleEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'content_id', type: 'uuid' }),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "contentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => content_entity_1.ContentEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'content_id' }),
    __metadata("design:type", content_entity_1.ContentEntity)
], ScheduleEntity.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_time', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ScheduleEntity.prototype, "startTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_time', type: 'timestamptz' }),
    __metadata("design:type", Date)
], ScheduleEntity.prototype, "endTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'screen_ids', type: 'text', array: true }),
    __metadata("design:type", Array)
], ScheduleEntity.prototype, "screenIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ev_location', type: 'varchar' }),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "evLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_synced_by_ev', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], ScheduleEntity.prototype, "isSyncedByEV", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: adnexus_types_1.PlaybackMode }),
    __metadata("design:type", String)
], ScheduleEntity.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ScheduleEntity.prototype, "createdById", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'created_by_id' }),
    __metadata("design:type", Object)
], ScheduleEntity.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], ScheduleEntity.prototype, "createdAt", void 0);
exports.ScheduleEntity = ScheduleEntity = __decorate([
    (0, typeorm_1.Entity)('adnexus_schedules')
], ScheduleEntity);
//# sourceMappingURL=schedule.entity.js.map