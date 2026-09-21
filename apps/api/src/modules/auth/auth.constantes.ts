/** Parámetros de sesión definidos en ADR-0003. */
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TTL_DIAS = 7;

export const COOKIE_REFRESH = 'refresh_token';
/** La cookie solo viaja a /auth: ningún otro endpoint la necesita. */
export const COOKIE_REFRESH_PATH = '/auth';

/**
 * Hash bcrypt de un valor aleatorio descartado. Se compara contra él cuando el email no existe,
 * para que responder tarde lo mismo y no se pueda deducir qué correos están registrados.
 */
export const HASH_FICTICIO = '$2b$12$cQFA4jgyaijYSQJUinTiJ.bI.qCnR4wNPkMA2QI7S3LKbvlpp73YC';
