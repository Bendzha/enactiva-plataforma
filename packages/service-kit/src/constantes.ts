/**
 * Cuánto vive en memoria el estado de sesión que cada servicio le pide a identity-service
 * (ADR-0007, decisión D2).
 *
 * El monolito releía roles y estado desde la base en CADA petición, para que quitarle el acceso
 * a alguien surtiera efecto de inmediato. Con servicios separados eso sería una llamada de red
 * por petición. La caché es el punto medio: la desactivación surte efecto en ≤30 s en vez de
 * esperar los 15 minutos que dura el access token.
 */
export const TTL_ESTADO_SESION_MS = 30_000;

/** Cabecera que identifica una petición a través de los cinco procesos (ADR-0007). */
export const CABECERA_REQUEST_ID = 'x-request-id';
