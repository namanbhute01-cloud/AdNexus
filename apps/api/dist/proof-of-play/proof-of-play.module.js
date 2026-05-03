"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProofOfPlayModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const proof_of_play_entity_1 = require("../database/entities/proof-of-play.entity");
const proof_of_play_service_1 = require("./proof-of-play.service");
const proof_of_play_controller_1 = require("./proof-of-play.controller");
let ProofOfPlayModule = class ProofOfPlayModule {
};
exports.ProofOfPlayModule = ProofOfPlayModule;
exports.ProofOfPlayModule = ProofOfPlayModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([proof_of_play_entity_1.ProofOfPlayEntity])],
        providers: [proof_of_play_service_1.ProofOfPlayService],
        controllers: [proof_of_play_controller_1.ProofOfPlayController],
    })
], ProofOfPlayModule);
//# sourceMappingURL=proof-of-play.module.js.map