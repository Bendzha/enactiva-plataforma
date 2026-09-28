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
  PORT_MATCHING: z.coerce.number().int().positive().default(3104),
  DATABASE_URL_MATCHING: z.string().min(1, 'DATABASE_URL_MATCHING es obligatoria'),
  /** Firmado por auth-service; aquí solo se verifica. */
  JWT_ACCESS_SECRET: secretoJwtSchema,
  /** Personas, áreas, temas y perfiles de interés para calcular la afinidad. */
  URL_IDENTITY_SERVICE: urlServicioSchema.default('http://localhost:3102'),
  /** Cursos en etapa Diagnóstico y valoración de cada capacitador. */
  URL_LEARNING_SERVICE: urlServicioSchema.default('http://localhost:3103'),
});

export const { env, limpiarCacheEnv } = crearEnv(esquema, 'el .env de la raíz del repositorio');
export type Env = z.infer<typeof esquema>;
