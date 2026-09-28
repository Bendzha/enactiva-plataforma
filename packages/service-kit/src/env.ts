import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config } from 'dotenv';
import { z, type ZodType } from 'zod';

/**
 * Carga el `.env` del servicio y después el de la raíz del monorepo.
 *
 * Los cinco servicios comparten el secreto del JWT y las credenciales de las bases, así que la
 * configuración vive en un solo `.env` en la raíz (ADR-0007). dotenv no sobrescribe variables ya
 * definidas, por eso el del servicio se carga primero: lo que esté ahí gana.
 */
export function cargarEnvRaiz(): void {
  config({ path: join(process.cwd(), '.env'), quiet: true });

  const raiz = buscarRaizMonorepo(process.cwd());
  if (raiz) {
    config({ path: join(raiz, '.env'), quiet: true });
  }
}

function buscarRaizMonorepo(desde: string): string | null {
  let actual = desde;

  // Se sube hasta encontrar el archivo que marca la raíz del workspace de pnpm.
  for (;;) {
    if (existsSync(join(actual, 'pnpm-workspace.yaml'))) {
      return actual;
    }
    const padre = dirname(actual);
    if (padre === actual) {
      return null;
    }
    actual = padre;
  }
}

/** Variables que todo proceso necesita. Cada servicio extiende este esquema con las suyas. */
export const esquemaEnvBase = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Origen del frontend autorizado a llamar con cookies. */
  WEB_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

/** El secreto del access token: lo comparten auth-service y todos los que verifican tokens. */
export const secretoJwtSchema = z.string().min(32, 'debe tener al menos 32 caracteres');

/** URL de otro servicio para las llamadas internas. */
export const urlServicioSchema = z.url('debe ser una URL válida');

/**
 * Descarta las variables que quedaron vacías en el `.env`.
 *
 * `WEB_ORIGIN=` sin valor significa "no la definí", pero para Zod es una cadena vacía y los
 * valores por defecto no se aplican. Peor con los números: `z.coerce.number()` convierte `''`
 * en 0 y el servicio arranca con un límite de cero intentos de login.
 */
function sinValoresVacios(variables: NodeJS.ProcessEnv): Record<string, string> {
  const limpias: Record<string, string> = {};

  for (const [clave, valor] of Object.entries(variables)) {
    if (valor !== undefined && valor.trim() !== '') {
      limpias[clave] = valor;
    }
  }

  return limpias;
}

export interface AccesoEnv<Salida> {
  env: () => Salida;
  /** Solo para tests que cambian variables de entorno en caliente. */
  limpiarCacheEnv: () => void;
}

/**
 * Valida la configuración la primera vez que se pide y la deja en caché.
 * Validar al arrancar evita descubrir en producción que faltaba un secreto.
 */
export function crearEnv<Salida>(
  schema: ZodType<Salida>,
  dondeCorregir: string,
): AccesoEnv<Salida> {
  let cache: Salida | undefined;

  return {
    env(): Salida {
      if (cache === undefined) {
        const resultado = schema.safeParse(sinValoresVacios(process.env));
        if (!resultado.success) {
          const detalle = resultado.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          throw new Error(`Configuración inválida (revisa ${dondeCorregir}) → ${detalle}`);
        }
        cache = resultado.data;
      }
      return cache;
    },
    limpiarCacheEnv(): void {
      cache = undefined;
    },
  };
}
