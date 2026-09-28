import { cargarEnvRaiz, crearEnv, esquemaEnvBase, urlServicioSchema } from '@enactiva/service-kit';
import { z } from 'zod';

// Se carga al importar este módulo, antes de que cualquier @Module lea la configuración.
cargarEnvRaiz();

/**
 * El gateway NO valida tokens (ADR-0007), así que tampoco necesita el secreto del JWT: cada
 * servicio verifica el suyo. Menos secretos en el proceso que está expuesto a internet.
 */
const esquema = esquemaEnvBase.extend({
  // 3010 mientras el monolito siga usando el 3000. El gateway lo toma en la fase M2.
  PORT_GATEWAY: z.coerce.number().int().positive().default(3010),
  URL_AUTH_SERVICE: urlServicioSchema.default('http://localhost:3101'),
  URL_IDENTITY_SERVICE: urlServicioSchema.default('http://localhost:3102'),
  URL_LEARNING_SERVICE: urlServicioSchema.default('http://localhost:3103'),
  URL_MATCHING_SERVICE: urlServicioSchema.default('http://localhost:3104'),
});

export const { env, limpiarCacheEnv } = crearEnv(esquema, 'el .env de la raíz del repositorio');
export type Env = z.infer<typeof esquema>;
