import bcrypt from 'bcrypt';

/** Costo de bcrypt definido en ADR-0003. */
export const COSTO_BCRYPT = 12;

export function hashPassword(passwordPlano: string): Promise<string> {
  return bcrypt.hash(passwordPlano, COSTO_BCRYPT);
}

export function verificarPassword(passwordPlano: string, hash: string): Promise<boolean> {
  return bcrypt.compare(passwordPlano, hash);
}
