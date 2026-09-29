import { cargarEnvRaiz, crearEnv, esquemaEnvBase, secretoJwtSchema } from '@enactiva/service-kit';
import { z } from 'zod';

// Se carga al importar este módulo, antes de que cualquier @Module lea la configuración.
cargarEnvRaiz();

const esquema = esquemaEnvBase.extend({
  PORT_IDENTITY: z.coerce.number().int().positive().default(3102),
  /** Dueño de Usuario, UsuarioRol y TokenAcceso (ADR-0007, decisión D1). */
  DATABASE_URL_IDENTITY: z.string().min(1, 'DATABASE_URL_IDENTITY es obligatoria'),
  /** Firmado por auth-service; aquí solo se verifica. */
  JWT_ACCESS_SECRET: secretoJwtSchema,
  /** Solo este servicio lo necesita: es donde se calcula el hash de los tokens de refresh. */
  REFRESH_TOKEN_PEPPER: z.string().min(32, 'debe tener al menos 32 caracteres'),
  /** Secreto de las rutas `/interno/*`, compartido con auth-service (ADR-0007). */
  INTERNO_SECRETO: z.string().min(32, 'debe tener al menos 32 caracteres'),
  // Correo saliente: en local apunta a Mailpit, que no envía nada a internet (ADR-0004).
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  CORREO_DESDE: z.string().min(1).default('ENACTIVA <no-responder@plataforma.local>'),
});

export const { env, limpiarCacheEnv } = crearEnv(esquema, 'el .env de la raíz del repositorio');
export type Env = z.infer<typeof esquema>;
