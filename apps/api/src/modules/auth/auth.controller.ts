import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  loginSchema,
  type LoginInput,
  type RespuestaLogin,
  type UsuarioSesion,
} from '@enactiva/shared';
import type { Request, Response } from 'express';
import { Publico, SoloSesion } from '../../common/decoradores.js';
import { Sesion, type SesionActual } from '../../common/sesion.js';
import { ZodValidationPipe } from '../../common/zod.pipe.js';
import { env } from '../../config/env.js';
import { COOKIE_REFRESH, COOKIE_REFRESH_PATH } from './auth.constantes.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @Publico()
  @HttpCode(200)
  @Throttle({ default: { limit: env().LOGIN_INTENTOS_POR_MINUTO, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) datos: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaLogin> {
    const sesion = await this.auth.login(datos, req.ip);
    this.ponerCookieRefresh(res, sesion.refreshToken, sesion.refreshExpiraAt);
    return sesion.respuesta;
  }

  @Post('refresh')
  @Publico()
  @HttpCode(200)
  async refrescar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaLogin> {
    const sesion = await this.auth.refrescar(this.leerCookieRefresh(req), req.ip);
    this.ponerCookieRefresh(res, sesion.refreshToken, sesion.refreshExpiraAt);
    return sesion.respuesta;
  }

  @Post('logout')
  @Publico()
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.cerrarSesion(this.leerCookieRefresh(req));
    res.clearCookie(COOKIE_REFRESH, { path: COOKIE_REFRESH_PATH });
  }

  /** Perfil de la sesión actual, leído de la base: la web lo usa al recargar la página. */
  @Get('yo')
  @SoloSesion()
  async yo(@Sesion() sesion: SesionActual): Promise<UsuarioSesion> {
    return this.auth.perfil(sesion.usuarioId);
  }

  private leerCookieRefresh(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE_REFRESH];
  }

  private ponerCookieRefresh(res: Response, token: string, expiraAt: Date): void {
    res.cookie(COOKIE_REFRESH, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env().NODE_ENV === 'production',
      path: COOKIE_REFRESH_PATH,
      expires: expiraAt,
    });
  }
}
