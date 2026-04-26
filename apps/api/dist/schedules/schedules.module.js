"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const schedule_entity_1 = require("../database/entities/schedule.entity");
const campaign_entity_1 = require("../database/entities/campaign.entity");
const screen_entity_1 = require("../database/entities/screen.entity");
const schedules_service_1 = require("./schedules.service");
const schedules_controller_1 = require("./schedules.controller");
const mqtt_gateway_module_1 = require("../mqtt-gateway/mqtt-gateway.module");
let SchedulesModule = class SchedulesModule {
};
exports.SchedulesModule = SchedulesModule;
exports.SchedulesModule = SchedulesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([schedule_entity_1.ScheduleEntity, campaign_entity_1.CampaignEntity, screen_entity_1.ScreenEntity]), mqtt_gateway_module_1.MqttGatewayModule],
        providers: [schedules_service_1.SchedulesService],
        controllers: [schedules_controller_1.SchedulesController],
        exports: [schedules_service_1.SchedulesService, typeorm_1.TypeOrmModule],
    })
], SchedulesModule);
//# sourceMappingURL=schedules.module.js.map