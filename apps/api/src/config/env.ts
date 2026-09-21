import { z } from 'zod';

// Validar la configuración al arrancar evita descubrir en producción que faltaba un secreto.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  JWT_ACCESS_SECRET: z.string().min(32, 'debe tener al menos 32 caracteres'),
  REFRESH_TOKEN_PEPPER: z.string().min(32, 'debe tener al menos 32 caracteres'),
  LOGIN_INTENTOS_POR_MINUTO: z.coerce.number().int().positive().default(5),
  /** Origen del frontend autorizado a llamar a la API con cookies. */
  WEB_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export type Env = z.infer<typeof envSchema>;

let cache: Env | undefined;

export function env(): Env {
  if (!cache) {
    const resultado = envSchema.safeParse(process.env);
    if (!resultado.success) {
      const detalle = resultado.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Configuración inválida (revisa apps/api/.env) → ${detalle}`);
    }
    cache = resultado.data;
  }
  return cache;
}

/** Solo para tests que cambian variables de entorno en caliente. */
export function limpiarCacheEnv(): void {
  cache = undefined;
}
