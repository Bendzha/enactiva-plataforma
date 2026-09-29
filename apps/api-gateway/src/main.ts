import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarGateway } from './configurar.js';
import { env } from './config/env.js';

async function bootstrap() {
  // Sin body parser: el gateway reenvía el cuerpo tal cual. Si Nest lo leyera primero, el stream
  // llegaría consumido al servicio y cualquier POST se quedaría esperando para siempre.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  configurarGateway(app);
  app.enableShutdownHooks();

  const puerto = env().PORT_GATEWAY;
  await app.listen(puerto);
  new Logger('api-gateway').log(`Escuchando en http://localhost:${puerto}`);
}

await bootstrap();
