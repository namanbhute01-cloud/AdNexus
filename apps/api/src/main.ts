import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, forbidNonWhitelisted: true,
    transform: true, transformOptions: { enableImplicitConversion: true },
  }));
  app.enableCors({ origin: process.env.DASHBOARD_URL ?? 'http://localhost:3001' });
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
  console.log(`AdNexus API running on :${process.env.PORT ?? 3000}`);
}
bootstrap();
