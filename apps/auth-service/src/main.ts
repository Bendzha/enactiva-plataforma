import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // La cookie de refresh se lee aquí: es el único servicio que la usa (ADR-0007).
  app.use(cookieParser());
  app.enableShutdownHooks();

  const puerto = env().PORT_AUTH;
  await app.listen(puerto);
  new Logger('auth-service').log(`Escuchando en http://localhost:${puerto}`);
}

await bootstrap();
