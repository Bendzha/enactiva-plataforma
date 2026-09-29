import bcrypt from 'bcrypt';

/** Costo de bcrypt definido en ADR-0003. */
export const COSTO_BCRYPT = 12;

export function hashPassword(passwordPlano: string): Promise<string> {
  return bcrypt.hash(passwordPlano, COSTO_BCRYPT);
}

export function verificarPassword(passwordPlano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(passwordPlano, hash);
}

/**
 * Hash bcrypt de un valor aleatorio descartado. Se compara contra él cuando el email no existe,
 * para que responder tarde lo mismo y no se pueda deducir qué correos están registrados.
 */
export const HASH_FICTICIO = '$2b$12$cQFA4jgyaijYSQJUinTiJ.bI.qCnR4wNPkMA2QI7S3LKbvlpp73YC';
