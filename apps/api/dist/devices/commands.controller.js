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
exports.CommandsController = void 0;
const common_1 = require("@nestjs/common");
const devices_service_1 = require("./devices.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const send_command_dto_1 = require("./dto/send-command.dto");
const schedules_service_1 = require("../schedules/schedules.service");
let CommandsController = class CommandsController {
    devicesService;
    schedulesService;
    constructor(devicesService, schedulesService) {
        this.devicesService = devicesService;
        this.schedulesService = schedulesService;
    }
    restartDevice(id) {
        return this.devicesService.sendCommand(id, 'RESTART');
    }
    skipCurrent(id) {
        return this.devicesService.sendCommand(id, 'SKIP_AD');
    }
    sendDeviceCommand(id, dto) {
        return this.devicesService.sendCommand(id, dto.command, dto.payload ?? {});
    }
    emergencyOverride(body) {
        return this.schedulesService.emergencyOverride(body.campaignId, body.deviceIds ?? []);
    }
};
exports.CommandsController = CommandsController;
__decorate([
    (0, common_1.Post)('device/:id/restart'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommandsController.prototype, "restartDevice", null);
__decorate([
    (0, common_1.Post)('device/:id/skip'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], CommandsController.prototype, "skipCurrent", null);
__decorate([
    (0, common_1.Post)('device/:id/send'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, send_command_dto_1.SendCommandDto]),
    __metadata("design:returntype", void 0)
], CommandsController.prototype, "sendDeviceCommand", null);
__decorate([
    (0, common_1.Post)('emergency-override'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CommandsController.prototype, "emergencyOverride", null);
exports.CommandsController = CommandsController = __decorate([
    (0, common_1.Controller)('commands'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [devices_service_1.DevicesService,
        schedules_service_1.SchedulesService])
], CommandsController);
//# sourceMappingURL=commands.controller.js.map