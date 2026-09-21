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
import { borrarCookieRefresh, leerCookieRefresh, ponerCookieRefresh } from './auth.cookies.js';
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
    ponerCookieRefresh(res, sesion.refreshToken, sesion.refreshExpiraAt);
    return sesion.respuesta;
  }

  @Post('refresh')
  @Publico()
  @HttpCode(200)
  async refrescar(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaLogin> {
    const sesion = await this.auth.refrescar(leerCookieRefresh(req), req.ip);
    ponerCookieRefresh(res, sesion.refreshToken, sesion.refreshExpiraAt);
    return sesion.respuesta;
  }

  @Post('logout')
  @Publico()
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.cerrarSesion(leerCookieRefresh(req));
    borrarCookieRefresh(res);
  }

  /** Perfil de la sesión actual, leído de la base: la web lo usa al recargar la página. */
  @Get('yo')
  @SoloSesion()
  async yo(@Sesion() sesion: SesionActual): Promise<UsuarioSesion> {
    return this.auth.perfil(sesion.usuarioId);
  }
}
