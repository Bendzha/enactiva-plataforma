import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  aceptarInvitacionInternaSchema,
  cerrarSesionInternaSchema,
  loginInternoSchema,
  PREFIJO_INTERNO,
  refrescarInternoSchema,
  type AceptarInvitacionInternaInput,
  type CerrarSesionInternaInput,
  type EstadoSesionInterno,
  type LoginInternoInput,
  type RefrescarInternoInput,
  type SesionEstablecida,
  type UsuarioSesion,
} from '@enactiva/shared';
import { Sesion, SoloInterno, SoloSesion, ZodValidationPipe } from '@enactiva/service-kit';
import type { SesionActual } from '@enactiva/service-kit';
import { InvitacionesService } from '../invitaciones/invitaciones.service.js';
import { SesionesService } from './sesiones.service.js';

/**
 * Rutas que solo llama otro servicio (ADR-0007). El gateway no las expone hacia afuera.
 *
 * Las cuatro primeras son anteriores al login, así que no hay token de usuario que reenviar y se
 * autentican con el secreto compartido. Las dos últimas sí usan el token de la persona: cada una
 * solo puede preguntar por sí misma, porque el usuario sale del token verificado y no de un
 * parámetro de la petición.
 */
@Controller(`${PREFIJO_INTERNO}/sesiones`)
export class SesionesController {
  constructor(
    private readonly sesiones: SesionesService,
    private readonly invitaciones: InvitacionesService,
  ) {}

  @Post('login')
  @SoloInterno()
  @HttpCode(200)
  login(
    @Body(new ZodValidationPipe(loginInternoSchema)) datos: LoginInternoInput,
  ): Promise<SesionEstablecida> {
    return this.sesiones.login(datos);
  }

  @Post('refrescar')
  @SoloInterno()
  @HttpCode(200)
  refrescar(
    @Body(new ZodValidationPipe(refrescarInternoSchema)) datos: RefrescarInternoInput,
  ): Promise<SesionEstablecida> {
    return this.sesiones.refrescar(datos);
  }

  @Post('cerrar')
  @SoloInterno()
  @HttpCode(204)
  cerrar(
    @Body(new ZodValidationPipe(cerrarSesionInternaSchema)) datos: CerrarSesionInternaInput,
  ): Promise<void> {
    return this.sesiones.cerrar(datos.token);
  }

  /**
   * Activación de una invitación: fija la contraseña, activa la cuenta y registra la aceptación
   * del aviso de privacidad en una sola transacción local, y deja la sesión establecida.
   */
  @Post('invitacion')
  @SoloInterno()
  @HttpCode(200)
  async aceptarInvitacion(
    @Body(new ZodValidationPipe(aceptarInvitacionInternaSchema))
    datos: AceptarInvitacionInternaInput,
  ): Promise<SesionEstablecida> {
    const usuarioId = await this.invitaciones.aceptar(datos, datos.ip ?? null);
    return this.sesiones.establecer(usuarioId);
  }

  /** Lo que el guard de cada servicio consulta y cachea 30 s. */
  @Get('actual')
  @SoloSesion()
  estado(@Sesion() sesion: SesionActual): Promise<EstadoSesionInterno> {
    return this.sesiones.estado(sesion.usuarioId);
  }

  /** Perfil completo para `GET /auth/yo`; va aparte para no cachear datos personales. */
  @Get('perfil')
  @SoloSesion()
  perfil(@Sesion() sesion: SesionActual): Promise<UsuarioSesion> {
    return this.sesiones.perfil(sesion.usuarioId);
  }
}
