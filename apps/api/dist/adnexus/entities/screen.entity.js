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
exports.ScreenEntity = void 0;
const typeorm_1 = require("typeorm");
const adnexus_types_1 = require("../adnexus.types");
const user_entity_1 = require("./user.entity");
let ScreenEntity = class ScreenEntity {
    id;
    screenId;
    name;
    evLocation;
    uniqueHardwareId;
    currentContentUrl;
    currentContentTitle;
    currentContentType;
    status;
    currentSeekSeconds;
    currentScheduleId;
    currentSignature;
    lastSeenAt;
    userId;
    user;
    createdAt;
};
exports.ScreenEntity = ScreenEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], ScreenEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'screen_id', type: 'varchar', unique: true }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "screenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ev_location', type: 'varchar' }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "evLocation", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unique_hardware_id', type: 'varchar', unique: true }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "uniqueHardwareId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_content_url', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "currentContentUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_content_title', type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "currentContentTitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_content_type', type: 'enum', enum: adnexus_types_1.ContentType, nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "currentContentType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: adnexus_types_1.ScreenStatus,
        default: adnexus_types_1.ScreenStatus.Offline,
    }),
    __metadata("design:type", String)
], ScreenEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_seek_seconds', type: 'float', default: 0 }),
    __metadata("design:type", Number)
], ScreenEntity.prototype, "currentSeekSeconds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_schedule_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "currentScheduleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_signature', type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "currentSignature", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_seen_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "lastSeenAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: true, unique: true }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.UserEntity, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", Object)
], ScreenEntity.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], ScreenEntity.prototype, "createdAt", void 0);
exports.ScreenEntity = ScreenEntity = __decorate([
    (0, typeorm_1.Entity)('screens')
], ScreenEntity);
//# sourceMappingURL=screen.entity.js.map