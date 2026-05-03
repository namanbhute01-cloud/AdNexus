"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreensModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const screen_entity_1 = require("../database/entities/screen.entity");
const screens_service_1 = require("./screens.service");
const screens_controller_1 = require("./screens.controller");
let ScreensModule = class ScreensModule {
};
exports.ScreensModule = ScreensModule;
exports.ScreensModule = ScreensModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([screen_entity_1.ScreenEntity])],
        providers: [screens_service_1.ScreensService],
        controllers: [screens_controller_1.ScreensController],
        exports: [screens_service_1.ScreensService, typeorm_1.TypeOrmModule],
    })
], ScreensModule);
//# sourceMappingURL=screens.module.js.map