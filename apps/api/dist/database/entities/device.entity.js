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
exports.DeviceEntity = exports.DeviceStatus = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("./organization.entity");
var DeviceStatus;
(function (DeviceStatus) {
    DeviceStatus["ONLINE"] = "ONLINE";
    DeviceStatus["OFFLINE"] = "OFFLINE";
    DeviceStatus["MAINTENANCE"] = "MAINTENANCE";
})(DeviceStatus || (exports.DeviceStatus = DeviceStatus = {}));
let DeviceEntity = class DeviceEntity {
    id;
    serialNumber;
    organizationId;
    organization;
    status;
    lastHeartbeat;
    location;
    firmwareVersion;
    createdAt;
};
exports.DeviceEntity = DeviceEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)('uuid'),
    __metadata("design:type", String)
], DeviceEntity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'serial_number', type: 'varchar', unique: true }),
    __metadata("design:type", String)
], DeviceEntity.prototype, "serialNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], DeviceEntity.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.OrganizationEntity, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.OrganizationEntity)
], DeviceEntity.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: DeviceStatus,
        default: DeviceStatus.OFFLINE,
    }),
    __metadata("design:type", String)
], DeviceEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_heartbeat', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], DeviceEntity.prototype, "lastHeartbeat", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], DeviceEntity.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'firmware_version', type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], DeviceEntity.prototype, "firmwareVersion", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz', name: 'created_at' }),
    __metadata("design:type", Date)
], DeviceEntity.prototype, "createdAt", void 0);
exports.DeviceEntity = DeviceEntity = __decorate([
    (0, typeorm_1.Entity)('devices')
], DeviceEntity);
//# sourceMappingURL=device.entity.js.map