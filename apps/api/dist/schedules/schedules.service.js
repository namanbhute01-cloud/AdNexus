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
exports.SchedulesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const schedule_entity_1 = require("../database/entities/schedule.entity");
const campaign_entity_1 = require("../database/entities/campaign.entity");
const screen_entity_1 = require("../database/entities/screen.entity");
const mqtt_gateway_service_1 = require("../mqtt-gateway/mqtt-gateway.service");
let SchedulesService = class SchedulesService {
    schedulesRepo;
    campaignsRepo;
    screensRepo;
    mqttGatewayService;
    constructor(schedulesRepo, campaignsRepo, screensRepo, mqttGatewayService) {
        this.schedulesRepo = schedulesRepo;
        this.campaignsRepo = campaignsRepo;
        this.screensRepo = screensRepo;
        this.mqttGatewayService = mqttGatewayService;
    }
    async createSlot(dto) {
        const start = new Date(dto.startTime);
        const end = new Date(dto.endTime);
        if (end <= start) {
            throw new common_1.BadRequestException('endTime must be greater than startTime');
        }
        const campaign = await this.campaignsRepo.findOne({ where: { id: dto.campaignId } });
        if (!campaign)
            throw new common_1.NotFoundException(`Campaign ${dto.campaignId} not found`);
        const overlapping = await this.schedulesRepo
            .createQueryBuilder('s')
            .where('s.device_id = :deviceId', { deviceId: dto.deviceId })
            .andWhere('s.screen_position = :screen', { screen: dto.screenPosition })
            .andWhere(':start < s.end_time AND :end > s.start_time', {
            start: start.toISOString(),
            end: end.toISOString(),
        })
            .getOne();
        if (overlapping) {
            throw new common_1.BadRequestException('Schedule overlap detected for same device/screen');
        }
        const slot = this.schedulesRepo.create({
            id: (0, crypto_1.randomUUID)(),
            campaignId: dto.campaignId,
            deviceId: dto.deviceId,
            screenPosition: dto.screenPosition,
            playMode: dto.playMode,
            startTime: start,
            endTime: end,
            repeatInterval: dto.repeatInterval,
        });
        return this.schedulesRepo.save(slot);
    }
    async deleteSlot(id) {
        await this.schedulesRepo.delete({ id });
        return { ok: true };
    }
    async getDeviceSchedule(deviceId) {
        const slots = await this.schedulesRepo.find({
            where: { deviceId },
            order: { startTime: 'ASC' },
        });
        const screens = await this.screensRepo.find({ where: { deviceId } });
        const campaignIds = slots.map((slot) => slot.campaignId).filter(Boolean);
        const campaigns = campaignIds.length
            ? await this.campaignsRepo.findBy({ id: (0, typeorm_2.In)(campaignIds) })
            : [];
        const campaignById = new Map(campaigns.map((item) => [item.id, item]));
        const screenMap = {
            A: { mode: 'INDEPENDENT', slots: [] },
            B: { mode: 'INDEPENDENT', slots: [] },
            C: { mode: 'INDEPENDENT', slots: [] },
        };
        for (const slot of slots) {
            const targetScreens = slot.screenPosition === schedule_entity_1.ScheduleScreenPosition.ALL
                ? [screen_entity_1.ScreenPosition.A, screen_entity_1.ScreenPosition.B, screen_entity_1.ScreenPosition.C]
                : [this.toScreenPosition(slot.screenPosition)];
            const campaign = campaignById.get(slot.campaignId);
            for (const screen of targetScreens) {
                screenMap[screen].mode = slot.playMode;
                screenMap[screen].slots.push({
                    campaign_id: slot.campaignId,
                    asset_url: campaign?.mediaUrl ?? '',
                    asset_checksum: campaign?.mediaChecksum ?? '',
                    start_time: slot.startTime.toISOString(),
                    end_time: slot.endTime.toISOString(),
                    loop: true,
                });
            }
        }
        const knownPositions = new Set(screens.map((screen) => screen.position));
        if (!knownPositions.has(screen_entity_1.ScreenPosition.A))
            screenMap.A = { mode: 'INDEPENDENT', slots: [] };
        if (!knownPositions.has(screen_entity_1.ScreenPosition.B))
            screenMap.B = { mode: 'INDEPENDENT', slots: [] };
        if (!knownPositions.has(screen_entity_1.ScreenPosition.C))
            screenMap.C = { mode: 'INDEPENDENT', slots: [] };
        return {
            device_id: deviceId,
            generated_at: new Date().toISOString(),
            screens: screenMap,
        };
    }
    async emergencyOverride(campaignId, deviceIds) {
        const campaign = await this.campaignsRepo.findOne({ where: { id: campaignId } });
        if (!campaign)
            throw new common_1.NotFoundException(`Campaign ${campaignId} not found`);
        const start = new Date();
        const end = new Date(start.getTime() + 15 * 60 * 1000);
        const targets = deviceIds.length > 0
            ? deviceIds
            : (await this.screensRepo
                .createQueryBuilder('s')
                .select('DISTINCT s.device_id', 'device_id')
                .getRawMany())
                .map((row) => row.device_id);
        const toSave = targets.map((deviceId) => this.schedulesRepo.create({
            id: (0, crypto_1.randomUUID)(),
            campaignId,
            deviceId,
            screenPosition: schedule_entity_1.ScheduleScreenPosition.ALL,
            playMode: schedule_entity_1.PlayMode.MIRROR,
            startTime: start,
            endTime: end,
        }));
        if (toSave.length > 0) {
            await this.schedulesRepo.save(toSave);
        }
        await this.mqttGatewayService.publishFleetEmergency({
            command: 'EMERGENCY_OVERRIDE',
            campaignId,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            deviceIds: targets,
        });
        return { ok: true, affectedDevices: targets.length };
    }
    toScreenPosition(value) {
        if (value === schedule_entity_1.ScheduleScreenPosition.A)
            return screen_entity_1.ScreenPosition.A;
        if (value === schedule_entity_1.ScheduleScreenPosition.B)
            return screen_entity_1.ScreenPosition.B;
        return screen_entity_1.ScreenPosition.C;
    }
};
exports.SchedulesService = SchedulesService;
exports.SchedulesService = SchedulesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(schedule_entity_1.ScheduleEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(campaign_entity_1.CampaignEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(screen_entity_1.ScreenEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        mqtt_gateway_service_1.MqttGatewayService])
], SchedulesService);
//# sourceMappingURL=schedules.service.js.map