import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  // La web vive en otro puerto en desarrollo y necesita enviar la cookie de refresh.
  app.enableCors({ origin: env().WEB_ORIGIN, credentials: true });
  app.enableShutdownHooks();
  await app.listen(env().PORT);
}

await bootstrap();
