import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { EstadoInvitacion } from '@enactiva/shared';
import { Publico } from '@enactiva/service-kit';
import { InvitacionesService } from './invitaciones.service.js';

/**
 * Ruta pública: quien llega con el enlace del correo todavía no tiene cuenta activa.
 * El límite por minuto evita que alguien pruebe tokens al azar.
 *
 * Aceptar la invitación vive en auth-service, porque termina en una sesión iniciada y solo ese
 * servicio firma tokens (ADR-0007). La parte que escribe en la base es el endpoint interno
 * `POST /interno/sesiones/invitacion`.
 */
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
}
