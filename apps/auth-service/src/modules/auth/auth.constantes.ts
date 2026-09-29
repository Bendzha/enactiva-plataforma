/** Parámetros de sesión definidos en ADR-0003. */
export const ACCESS_TOKEN_TTL = '15m';

export const COOKIE_REFRESH = 'refresh_token';
/** La cookie solo viaja a /auth: ningún otro endpoint la necesita. */
export const COOKIE_REFRESH_PATH = '/auth';
