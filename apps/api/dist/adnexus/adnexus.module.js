"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdNexusModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const auth_module_1 = require("../auth/auth.module");
const adnexus_gateway_1 = require("./adnexus.gateway");
const adnexus_service_1 = require("./adnexus.service");
const adnexus_controller_1 = require("./adnexus.controller");
const user_entity_1 = require("./entities/user.entity");
const screen_entity_1 = require("./entities/screen.entity");
const content_entity_1 = require("./entities/content.entity");
const schedule_entity_1 = require("./entities/schedule.entity");
let AdNexusModule = class AdNexusModule {
};
exports.AdNexusModule = AdNexusModule;
exports.AdNexusModule = AdNexusModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, typeorm_1.TypeOrmModule.forFeature([user_entity_1.UserEntity, screen_entity_1.ScreenEntity, content_entity_1.ContentEntity, schedule_entity_1.ScheduleEntity])],
        providers: [adnexus_service_1.AdNexusService, adnexus_gateway_1.AdNexusGateway],
        controllers: [adnexus_controller_1.AdNexusAuthController, adnexus_controller_1.AdNexusScreenController, adnexus_controller_1.AdNexusAdminController, adnexus_controller_1.AdNexusCampaignerController],
        exports: [adnexus_service_1.AdNexusService, adnexus_gateway_1.AdNexusGateway],
    })
], AdNexusModule);
//# sourceMappingURL=adnexus.module.js.map