import type { INestApplication } from '@nestjs/common';
import { env } from './config/env.js';
import { bloquearRutasInternas, marcarPeticion, proxiesPorPrefijo } from './proxy.js';

/**
 * Deja el gateway listo: CORS con cookies, marca de petición, bloqueo de rutas internas y un
 * proxy por prefijo.
 *
 * Está aparte de `main.ts` para que los tests levanten exactamente el mismo gateway que corre en
 * producción, y no una versión parecida.
 */
export function configurarGateway(app: INestApplication): void {
  app.enableCors({ origin: env().WEB_ORIGIN, credentials: true });

  app.use(marcarPeticion());
  app.use(bloquearRutasInternas());
  for (const proxy of proxiesPorPrefijo()) {
    app.use(proxy);
  }
}
