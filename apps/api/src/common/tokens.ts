import { createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/** Token opaco para refresh, invitaciones y reseteos. Se entrega una sola vez y no se guarda. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

/** En la base solo queda el HMAC del token, nunca el token en claro (ADR-0003). */
export function hashToken(token: string): string {
  return createHmac('sha256', env().REFRESH_TOKEN_PEPPER).update(token).digest('hex');
}
