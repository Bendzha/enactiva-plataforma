import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const puerto = env().PORT_LEARNING;
  await app.listen(puerto);
  new Logger('learning-service').log(`Escuchando en http://localhost:${puerto}`);
}

await bootstrap();
