"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const devices_module_1 = require("./devices/devices.module");
const screens_module_1 = require("./screens/screens.module");
const campaigns_module_1 = require("./campaigns/campaigns.module");
const schedules_module_1 = require("./schedules/schedules.module");
const proof_of_play_module_1 = require("./proof-of-play/proof-of-play.module");
const mqtt_gateway_module_1 = require("./mqtt-gateway/mqtt-gateway.module");
const websocket_gateway_module_1 = require("./websocket-gateway/websocket-gateway.module");
const adnexus_module_1 = require("./adnexus/adnexus.module");
const organization_entity_1 = require("./database/entities/organization.entity");
const device_entity_1 = require("./database/entities/device.entity");
const screen_entity_1 = require("./database/entities/screen.entity");
const campaign_entity_1 = require("./database/entities/campaign.entity");
const schedule_entity_1 = require("./database/entities/schedule.entity");
const proof_of_play_entity_1 = require("./database/entities/proof-of-play.entity");
const user_entity_1 = require("./adnexus/entities/user.entity");
const screen_entity_2 = require("./adnexus/entities/screen.entity");
const content_entity_1 = require("./adnexus/entities/content.entity");
const schedule_entity_2 = require("./adnexus/entities/schedule.entity");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    type: 'postgres',
                    url: configService.get('DATABASE_URL'),
                    host: configService.get('DB_HOST', 'localhost'),
                    port: Number(configService.get('DB_PORT', '5432')),
                    username: configService.get('DB_USER', 'adnexus'),
                    password: configService.get('DB_PASSWORD', 'dev_password'),
                    database: configService.get('DB_NAME', 'adnexus'),
                    autoLoadEntities: true,
                    synchronize: configService.get('TYPEORM_SYNC', 'true') === 'true',
                    entities: [
                        organization_entity_1.OrganizationEntity,
                        device_entity_1.DeviceEntity,
                        screen_entity_1.ScreenEntity,
                        campaign_entity_1.CampaignEntity,
                        schedule_entity_1.ScheduleEntity,
                        proof_of_play_entity_1.ProofOfPlayEntity,
                        user_entity_1.UserEntity,
                        screen_entity_2.ScreenEntity,
                        content_entity_1.ContentEntity,
                        schedule_entity_2.ScheduleEntity,
                    ],
                }),
            }),
            auth_module_1.AuthModule,
            devices_module_1.DevicesModule,
            screens_module_1.ScreensModule,
            campaigns_module_1.CampaignsModule,
            schedules_module_1.SchedulesModule,
            proof_of_play_module_1.ProofOfPlayModule,
            mqtt_gateway_module_1.MqttGatewayModule,
            websocket_gateway_module_1.WebsocketGatewayModule,
            adnexus_module_1.AdNexusModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map