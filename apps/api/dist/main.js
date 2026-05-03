"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true, forbidNonWhitelisted: true,
        transform: true, transformOptions: { enableImplicitConversion: true },
    }));
    app.enableCors({ origin: process.env.DASHBOARD_URL ?? 'http://localhost:3001' });
    app.enableShutdownHooks();
    await app.listen(process.env.PORT ?? 3000);
    console.log(`AdNexus API running on :${process.env.PORT ?? 3000}`);
}
bootstrap();
//# sourceMappingURL=main.js.map