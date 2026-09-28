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
  PORT_LEARNING: z.coerce.number().int().positive().default(3103),
  DATABASE_URL_LEARNING: z.string().min(1, 'DATABASE_URL_LEARNING es obligatoria'),
  /** Firmado por auth-service; aquí solo se verifica. */
  JWT_ACCESS_SECRET: secretoJwtSchema,
  /**
   * Los cursos guardan `capacitadorId` y `temaId` sin clave foránea: los nombres de las personas
   * y de los temas se piden a identity-service (ADR-0007).
   */
  URL_IDENTITY_SERVICE: urlServicioSchema.default('http://localhost:3102'),
});

export const { env, limpiarCacheEnv } = crearEnv(esquema, 'el .env de la raíz del repositorio');
export type Env = z.infer<typeof esquema>;
