import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  aceptarInvitacionSchema,
  loginSchema,
  type AceptarInvitacionInput,
  type LoginInput,
  type RespuestaLogin,
  type UsuarioSesion,
} from '@enactiva/shared';
import { Publico, SoloSesion, ZodValidationPipe } from '@enactiva/service-kit';
import type { Request, Response } from 'express';
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

  /**
   * Activación de una invitación. Vive aquí y no en identity-service porque termina en una
   * sesión iniciada, y solo este servicio firma tokens (ADR-0007). El trabajo sobre la base lo
   * hace identity en una transacción local.
   */
  @Post('invitaciones/aceptar')
  @Publico()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async aceptarInvitacion(
    @Body(new ZodValidationPipe(aceptarInvitacionSchema)) datos: AceptarInvitacionInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaLogin> {
    const sesion = await this.auth.aceptarInvitacion(datos, req.ip);
    ponerCookieRefresh(res, sesion.refreshToken, sesion.refreshExpiraAt);
    return sesion.respuesta;
  }

  /** Perfil de la sesión actual, leído de identity y no del token. */
  @Get('yo')
  @SoloSesion()
  yo(): Promise<UsuarioSesion> {
    return this.auth.perfil();
  }
}
