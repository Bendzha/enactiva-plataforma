import { PREFIJO_INTERNO } from '@enactiva/shared';

export interface RutaGateway {
  /** Prefijo que ve el navegador. */
  prefijo: string;
  /** Si el prefijo se quita antes de reenviar al servicio. */
  quitarPrefijo: boolean;
  /** Nombre del servicio destino, para los logs. */
  servicio: string;
}

/**
 * Enrutamiento por prefijo (ADR-0007). El frontend habla solo con el gateway.
 *
 * `/auth` no se quita: `auth-service` expone sus rutas bajo `@Controller('auth')`, y así la
 * cookie de refresh, que está acotada a `Path=/auth`, sigue viajando por la misma ruta que el
 * navegador ve. Los demás prefijos sí se quitan, porque sus controladores no los llevan.
 */
export const RUTAS: readonly RutaGateway[] = [
  { prefijo: '/auth', quitarPrefijo: false, servicio: 'auth-service' },
  { prefijo: '/identity', quitarPrefijo: true, servicio: 'identity-service' },
  { prefijo: '/learning', quitarPrefijo: true, servicio: 'learning-service' },
  { prefijo: '/matching', quitarPrefijo: true, servicio: 'matching-service' },
];

/**
 * Las rutas `/interno/*` son conversaciones entre servicios y no se exponen jamás.
 *
 * Sin esta comprobación, `/identity/interno/sesiones/login` se convertiría en
 * `/interno/sesiones/login` al quitar el prefijo y llegaría al endpoint interno. Ahí lo pararía
 * el secreto compartido, pero el gateway no debe ni intentarlo: es la puerta de calle.
 */
export function esRutaInterna(ruta: string): boolean {
  const segmentos = ruta.split('?')[0]!.split('/');
  return segmentos.includes(PREFIJO_INTERNO);
}

/** Servicio al que corresponde una ruta, o null si el gateway no la conoce. */
export function rutaPara(ruta: string): RutaGateway | null {
  return RUTAS.find((r) => ruta === r.prefijo || ruta.startsWith(`${r.prefijo}/`)) ?? null;
}
