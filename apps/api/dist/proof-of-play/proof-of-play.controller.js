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
exports.ProofOfPlayController = void 0;
const common_1 = require("@nestjs/common");
const device_cert_guard_1 = require("../auth/device-cert.guard");
const proof_of_play_service_1 = require("./proof-of-play.service");
let ProofOfPlayController = class ProofOfPlayController {
    proofOfPlayService;
    constructor(proofOfPlayService) {
        this.proofOfPlayService = proofOfPlayService;
    }
    upload(id, events) {
        return this.proofOfPlayService.bulkUpload(id, events);
    }
};
exports.ProofOfPlayController = ProofOfPlayController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(device_cert_guard_1.DeviceCertGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", void 0)
], ProofOfPlayController.prototype, "upload", null);
exports.ProofOfPlayController = ProofOfPlayController = __decorate([
    (0, common_1.Controller)('devices/:id/proof-of-play'),
    __metadata("design:paramtypes", [proof_of_play_service_1.ProofOfPlayService])
], ProofOfPlayController);
//# sourceMappingURL=proof-of-play.controller.js.map