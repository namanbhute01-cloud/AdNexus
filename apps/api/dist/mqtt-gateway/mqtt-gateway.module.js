"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttGatewayModule = void 0;
const common_1 = require("@nestjs/common");
const devices_module_1 = require("../devices/devices.module");
const mqtt_gateway_service_1 = require("./mqtt-gateway.service");
const websocket_gateway_module_1 = require("../websocket-gateway/websocket-gateway.module");
let MqttGatewayModule = class MqttGatewayModule {
};
exports.MqttGatewayModule = MqttGatewayModule;
exports.MqttGatewayModule = MqttGatewayModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => devices_module_1.DevicesModule), websocket_gateway_module_1.WebsocketGatewayModule],
        providers: [mqtt_gateway_service_1.MqttGatewayService],
        exports: [mqtt_gateway_service_1.MqttGatewayService],
    })
], MqttGatewayModule);
//# sourceMappingURL=mqtt-gateway.module.js.map