import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { COOKIE_REFRESH, COOKIE_REFRESH_PATH } from './auth.constantes.js';

/** La cookie de refresh no es accesible desde JavaScript y solo viaja a /auth (ADR-0003). */
export function ponerCookieRefresh(res: Response, token: string, expiraAt: Date): void {
  res.cookie(COOKIE_REFRESH, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    path: COOKIE_REFRESH_PATH,
    expires: expiraAt,
  });
}

export function leerCookieRefresh(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[COOKIE_REFRESH];
}

export function borrarCookieRefresh(res: Response): void {
  res.clearCookie(COOKIE_REFRESH, { path: COOKIE_REFRESH_PATH });
}
