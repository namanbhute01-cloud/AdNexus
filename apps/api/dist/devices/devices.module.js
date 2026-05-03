"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_1 = require("@nestjs/jwt");
const device_entity_1 = require("../database/entities/device.entity");
const devices_service_1 = require("./devices.service");
const devices_controller_1 = require("./devices.controller");
const commands_controller_1 = require("./commands.controller");
const mqtt_gateway_module_1 = require("../mqtt-gateway/mqtt-gateway.module");
const websocket_gateway_module_1 = require("../websocket-gateway/websocket-gateway.module");
const schedules_module_1 = require("../schedules/schedules.module");
let DevicesModule = class DevicesModule {
};
exports.DevicesModule = DevicesModule;
exports.DevicesModule = DevicesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([device_entity_1.DeviceEntity]),
            jwt_1.JwtModule,
            (0, common_1.forwardRef)(() => mqtt_gateway_module_1.MqttGatewayModule),
            websocket_gateway_module_1.WebsocketGatewayModule,
            schedules_module_1.SchedulesModule,
        ],
        controllers: [devices_controller_1.DevicesController, commands_controller_1.CommandsController],
        providers: [devices_service_1.DevicesService],
        exports: [devices_service_1.DevicesService, typeorm_1.TypeOrmModule],
    })
], DevicesModule);
//# sourceMappingURL=devices.module.js.map