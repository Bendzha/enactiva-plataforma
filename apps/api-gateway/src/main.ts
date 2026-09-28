import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // El CORS con cookies se resuelve aquí: la web habla solo con el gateway (ADR-0007).
  app.enableCors({ origin: env().WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();

  const puerto = env().PORT_GATEWAY;
  await app.listen(puerto);
  new Logger('api-gateway').log(`Escuchando en http://localhost:${puerto}`);
}

await bootstrap();
