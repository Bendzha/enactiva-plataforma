import { randomUUID } from 'node:crypto';
import { CABECERA_REQUEST_ID } from './constantes.js';

/** Solo lo que necesitamos de la petición, para poder probar esto sin Express. */
interface CabecerasEntrantes {
  [clave: string]: string | string[] | undefined;
}

/**
 * Identificador de la petición a través de los cinco procesos (ADR-0007).
 *
 * El gateway genera uno nuevo y los demás servicios reutilizan el que reciben: así una petición
 * que cruza gateway → identity → learning deja la misma marca en los tres logs. Sin esto,
 * "el login falló" son cinco registros sin nada en común.
 *
 * Se acota el largo y se limpian los caracteres raros porque el valor llega de afuera y termina
 * escrito en los logs: un salto de línea permitiría inyectar una línea falsa.
 */
export function resolverRequestId(cabeceras: CabecerasEntrantes): string {
  const recibido = cabeceras[CABECERA_REQUEST_ID];
  const valor = Array.isArray(recibido) ? recibido[0] : recibido;
  const limpio = (valor ?? '').replace(/[^\w.:-]/g, '').slice(0, 64);
  return limpio.length > 0 ? limpio : randomUUID();
}
