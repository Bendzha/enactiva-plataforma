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
  /**
   * Secreto de las rutas internas (ADR-0007). Lo necesita el reloj de los recordatorios:
   * corre sin que haya nadie conectado, así que no tiene un token de usuario que reenviar.
   */
  INTERNO_SECRETO: z.string().min(32, 'debe tener al menos 32 caracteres'),
  // Correo saliente: en local apunta a Mailpit, que no envía nada a internet (ADR-0004).
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  CORREO_DESDE: z.string().min(1).default('ENACTIVA <no-responder@plataforma.local>'),
  /** Cada cuántos minutos revisa el reloj si hay recordatorios por mandar. */
  RECORDATORIOS_CADA_MINUTOS: z.coerce.number().int().positive().default(5),
});

export const { env, limpiarCacheEnv } = crearEnv(esquema, 'el .env de la raíz del repositorio');
export type Env = z.infer<typeof esquema>;
