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
exports.AdNexusCampaignerController = exports.AdNexusAdminController = exports.AdNexusScreenController = exports.AdNexusAuthController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const adnexus_service_1 = require("./adnexus.service");
const adnexus_types_1 = require("./adnexus.types");
const login_dto_1 = require("./dto/login.dto");
const create_user_dto_1 = require("./dto/create-user.dto");
const create_schedule_dto_1 = require("./dto/create-schedule.dto");
const update_screen_dto_1 = require("./dto/update-screen.dto");
let AdNexusAuthController = class AdNexusAuthController {
    adnexusService;
    constructor(adnexusService) {
        this.adnexusService = adnexusService;
    }
    bootstrapAdmin() {
        return this.adnexusService.ensureBootstrapAdmin().then((existing) => {
            if (existing) {
                return { alreadyBootstrapped: true };
            }
            return { ok: true };
        });
    }
    login(dto) {
        return this.adnexusService.loginUser(dto.username, dto.password);
    }
    me(req) {
        return {
            id: req.user.sub,
            username: req.user.username,
            role: req.user.roles[0] ?? null,
            screenId: req.user.screenId ?? null,
            evLocation: req.user.evLocation ?? null,
        };
    }
};
exports.AdNexusAuthController = AdNexusAuthController;
__decorate([
    (0, common_1.Post)('bootstrap-admin'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdNexusAuthController.prototype, "bootstrapAdmin", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto]),
    __metadata("design:returntype", void 0)
], AdNexusAuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdNexusAuthController.prototype, "me", null);
exports.AdNexusAuthController = AdNexusAuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [adnexus_service_1.AdNexusService])
], AdNexusAuthController);
let AdNexusScreenController = class AdNexusScreenController {
    adnexusService;
    constructor(adnexusService) {
        this.adnexusService = adnexusService;
    }
    loginScreen(dto) {
        return this.adnexusService.loginScreen(dto.username, dto.password, dto);
    }
    me(req) {
        return {
            id: req.user.sub,
            username: req.user.username,
            role: req.user.roles[0] ?? adnexus_types_1.AdNexusRole.Screen,
            screenId: req.user.screenId ?? null,
            evLocation: req.user.evLocation ?? null,
        };
    }
    state(req) {
        if (!req.user.screenId) {
            return null;
        }
        return this.adnexusService.getScreenState(req.user.screenId);
    }
};
exports.AdNexusScreenController = AdNexusScreenController;
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdNexusScreenController.prototype, "loginScreen", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(adnexus_types_1.AdNexusRole.Screen),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdNexusScreenController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('state'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(adnexus_types_1.AdNexusRole.Screen),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdNexusScreenController.prototype, "state", null);
exports.AdNexusScreenController = AdNexusScreenController = __decorate([
    (0, common_1.Controller)('screen'),
    __metadata("design:paramtypes", [adnexus_service_1.AdNexusService])
], AdNexusScreenController);
let AdNexusAdminController = class AdNexusAdminController {
    adnexusService;
    constructor(adnexusService) {
        this.adnexusService = adnexusService;
    }
    createUser(dto) {
        return this.adnexusService.createUser(dto);
    }
    listUsers() {
        return this.adnexusService.listUsers();
    }
    listScreens() {
        return this.adnexusService.listScreens();
    }
    updateScreen(id, dto) {
        return this.adnexusService.updateScreen(id, dto);
    }
    uploadContent(file, dto, req) {
        const ownerId = dto.ownerId ?? req.user.sub ?? '';
        return this.adnexusService.uploadContent(file, dto, ownerId);
    }
    listContent() {
        return this.adnexusService.listContent();
    }
    createSchedule(dto, req) {
        return this.adnexusService.createSchedules(dto, req.user.sub ?? '');
    }
    listSchedule() {
        return this.adnexusService.listSchedules();
    }
};
exports.AdNexusAdminController = AdNexusAdminController;
__decorate([
    (0, common_1.Post)('users'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_user_dto_1.CreateUserDto]),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Get)('users'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Get)('screens'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "listScreens", null);
__decorate([
    (0, common_1.Patch)('screens/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_screen_dto_1.UpdateScreenDto]),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "updateScreen", null);
__decorate([
    (0, common_1.Post)('content'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "uploadContent", null);
__decorate([
    (0, common_1.Get)('content'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "listContent", null);
__decorate([
    (0, common_1.Post)('schedule'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_schedule_dto_1.CreateScheduleDto, Object]),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "createSchedule", null);
__decorate([
    (0, common_1.Get)('schedule'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdNexusAdminController.prototype, "listSchedule", null);
exports.AdNexusAdminController = AdNexusAdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(adnexus_types_1.AdNexusRole.Admin),
    __metadata("design:paramtypes", [adnexus_service_1.AdNexusService])
], AdNexusAdminController);
let AdNexusCampaignerController = class AdNexusCampaignerController {
    adnexusService;
    constructor(adnexusService) {
        this.adnexusService = adnexusService;
    }
    screens() {
        return this.adnexusService.getCampaignerScreens();
    }
};
exports.AdNexusCampaignerController = AdNexusCampaignerController;
__decorate([
    (0, common_1.Get)('screens'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdNexusCampaignerController.prototype, "screens", null);
exports.AdNexusCampaignerController = AdNexusCampaignerController = __decorate([
    (0, common_1.Controller)('campaigner'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(adnexus_types_1.AdNexusRole.Campaigner),
    __metadata("design:paramtypes", [adnexus_service_1.AdNexusService])
], AdNexusCampaignerController);
//# sourceMappingURL=adnexus.controller.js.map