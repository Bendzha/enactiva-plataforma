import type { INestApplication } from '@nestjs/common';
import { confiarEnProxies } from '@enactiva/service-kit';
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
  // La puerta de calle: lee `X-Forwarded-For` solo si hay un proxy delante que la escriba. De
  // aquí sale la IP que después viaja a los servicios y termina en la auditoría.
  confiarEnProxies(app, env().PROXIES_DELANTE_DEL_GATEWAY, { esElGateway: true });

  app.enableCors({ origin: env().WEB_ORIGIN, credentials: true });

  app.use(marcarPeticion());
  app.use(bloquearRutasInternas());
  for (const proxy of proxiesPorPrefijo()) {
    app.use(proxy);
  }
}
