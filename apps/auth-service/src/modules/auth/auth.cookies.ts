import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { COOKIE_REFRESH, COOKIE_REFRESH_PATH } from './auth.constantes.js';

/**
 * La cookie de refresh no es accesible desde JavaScript y solo viaja a /auth (ADR-0003).
 *
 * Con `mantenerSesion` lleva vencimiento y sobrevive al cierre del navegador; sin él es una
 * **cookie de sesión** y muere con la ventana (SPEC §3.9). El token dura lo mismo en los dos
 * casos: la casilla no alarga nada, solo decide si el navegador se queda con la cookie.
 */
export function ponerCookieRefresh(
  res: Response,
  token: string,
  expiraAt: Date,
  mantenerSesion: boolean,
): void {
  res.cookie(COOKIE_REFRESH, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    path: COOKIE_REFRESH_PATH,
    // Omitir `expires` es lo que la convierte en cookie de sesión: no es lo mismo que ponerle
    // una fecha pasada, que la borraría.
    ...(mantenerSesion ? { expires: expiraAt } : {}),
  });
}

export function leerCookieRefresh(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[COOKIE_REFRESH];
}

export function borrarCookieRefresh(res: Response): void {
  res.clearCookie(COOKIE_REFRESH, { path: COOKIE_REFRESH_PATH });
}
