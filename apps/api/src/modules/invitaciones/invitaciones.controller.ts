import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  aceptarInvitacionSchema,
  type AceptarInvitacionInput,
  type EstadoInvitacion,
  type RespuestaLogin,
} from '@enactiva/shared';
import type { Request, Response } from 'express';
import { Publico } from '../../common/decoradores.js';
import { ZodValidationPipe } from '../../common/zod.pipe.js';
import { ponerCookieRefresh } from '../auth/auth.cookies.js';
import { InvitacionesService } from './invitaciones.service.js';

// Rutas públicas: quien llega con el enlace del correo todavía no tiene cuenta activa.
// El límite por minuto evita que alguien pruebe tokens al azar.
@Controller('invitaciones')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class InvitacionesController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  @Get('estado')
  @Publico()
  estado(@Query('token') token?: string): Promise<EstadoInvitacion> {
    if (!token) {
      throw new BadRequestException('Falta el token de la invitación');
    }
    return this.invitaciones.estado(token);
  }

  @Post('aceptar')
  @Publico()
  @HttpCode(200)
  async aceptar(
    @Body(new ZodValidationPipe(aceptarInvitacionSchema)) datos: AceptarInvitacionInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RespuestaLogin> {
    const sesion = await this.invitaciones.aceptar(datos, req.ip);
    ponerCookieRefresh(res, sesion.refreshToken, sesion.refreshExpiraAt);
    return sesion.respuesta;
  }
}
