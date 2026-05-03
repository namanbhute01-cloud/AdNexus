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
exports.ScreensService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const screen_entity_1 = require("../database/entities/screen.entity");
let ScreensService = class ScreensService {
    screensRepo;
    constructor(screensRepo) {
        this.screensRepo = screensRepo;
    }
    async getDeviceScreens(deviceId) {
        return this.screensRepo.find({
            where: { deviceId },
            order: { position: 'ASC' },
        });
    }
    async updateDisplayInfo(screenId, displayInfo) {
        const screen = await this.screensRepo.findOne({ where: { id: screenId } });
        if (!screen) {
            throw new common_1.NotFoundException(`Screen ${screenId} not found`);
        }
        screen.displayInfo = displayInfo;
        await this.screensRepo.save(screen);
        return screen;
    }
    async updatePassword(screenId, passwordHash) {
        const screen = await this.screensRepo.findOne({ where: { id: screenId } });
        if (!screen) {
            throw new common_1.NotFoundException(`Screen ${screenId} not found`);
        }
        screen.passwordHash = passwordHash;
        await this.screensRepo.save(screen);
        return screen;
    }
};
exports.ScreensService = ScreensService;
exports.ScreensService = ScreensService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(screen_entity_1.ScreenEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ScreensService);
//# sourceMappingURL=screens.service.js.map