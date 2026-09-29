/**
 * Vida del token de refresh (ADR-0003).
 *
 * Vive en identity-service porque es quien crea y guarda los tokens: auth-service solo recibe el
 * valor en claro para ponerlo en la cookie (ADR-0007).
 */
export const REFRESH_TTL_DIAS = 7;
