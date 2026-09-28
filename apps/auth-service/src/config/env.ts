import {
  cargarEnvRaiz,
  crearEnv,
  esquemaEnvBase,
  secretoJwtSchema,
  urlServicioSchema,
} from '@enactiva/service-kit';
import { z } from 'zod';

// Se carga al importar este módulo, antes de que cualquier @Module lea la configuración.
cargarEnvRaiz();

const esquema = esquemaEnvBase.extend({
  PORT_AUTH: z.coerce.number().int().positive().default(3101),
  /** auth-service es el único que FIRMA; los demás servicios usan el mismo secreto para verificar. */
  JWT_ACCESS_SECRET: secretoJwtSchema,
  /** Intentos de login permitidos por minuto y por IP. */
  LOGIN_INTENTOS_POR_MINUTO: z.coerce.number().int().positive().default(5),
  /**
   * auth-service no tiene base de datos: en el login le pide a identity-service que verifique la
   * contraseña (ADR-0007, decisión D1). El hash nunca sale de identity.
   */
  URL_IDENTITY_SERVICE: urlServicioSchema.default('http://localhost:3102'),
});

export const { env, limpiarCacheEnv } = crearEnv(esquema, 'el .env de la raíz del repositorio');
export type Env = z.infer<typeof esquema>;
