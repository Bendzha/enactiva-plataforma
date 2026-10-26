import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ocultarReferenciaSchema,
  valorarTallerSchema,
  type EstrellasDelTaller,
  type MiValoracion,
  type OcultarReferenciaInput,
  type ReconocimientoPersona,
  type ReferenciaPublicada,
  type ValorarTallerInput,
} from '@enactiva/shared';
import {
  RequierePermiso,
  Sesion,
  SoloSesion,
  ZodValidationPipe,
  type SesionActual,
} from '@enactiva/service-kit';
import { ReferenciasService } from './referencias.service.js';
import { ValoracionService } from './valoracion.service.js';

/**
 * Valoración del encuentro, referencias y reconocimiento (SPEC §3.5, ADR-0009).
 *
 * Las estrellas salen siempre promediadas y las referencias siempre firmadas: así lo pidió la
 * clienta, y es la diferencia entre un dato agregado y uno que expone a quien lo escribió.
 */
@Controller()
export class ValoracionController {
  constructor(
    private readonly valoracion: ValoracionService,
    private readonly referencias: ReferenciasService,
  ) {}

  /** Valorar un taller al que fui, después de que terminó. Una sola vez. */
  @Post('talleres/:id/valoracion')
  @SoloSesion()
  valorar(
    @Param('id', ParseUUIDPipe) tallerId: string,
    @Body(new ZodValidationPipe(valorarTallerSchema)) entrada: ValorarTallerInput,
    @Sesion() sesion: SesionActual,
  ): Promise<MiValoracion> {
    return this.valoracion.valorar(tallerId, entrada, sesion);
  }

  /** Lo que yo respondí, para no volver a pedírmelo y para poder mostrármelo. */
  @Get('talleres/:id/mi-valoracion')
  @SoloSesion()
  mia(
    @Param('id', ParseUUIDPipe) tallerId: string,
    @Sesion() sesion: SesionActual,
  ): Promise<MiValoracion | null> {
    return this.valoracion.mia(tallerId, sesion);
  }

  /** Las estrellas del taller, promediadas. Nunca quién puso qué. */
  @Get('talleres/:id/estrellas')
  @SoloSesion()
  estrellas(
    @Param('id', ParseUUIDPipe) tallerId: string,
    @Sesion() sesion: SesionActual,
  ): Promise<EstrellasDelTaller> {
    return this.valoracion.delTaller(tallerId, sesion);
  }

  @Get('talleres/:id/referencias')
  @SoloSesion()
  referenciasDelTaller(
    @Param('id', ParseUUIDPipe) tallerId: string,
    @Sesion() sesion: SesionActual,
  ): Promise<ReferenciaPublicada[]> {
    return this.referencias.delTaller(tallerId, sesion);
  }

  /** La tarjeta de reconocimiento de alguien: tokens, talleres dictados y estrellas. */
  @Get('personas/:id/reconocimiento')
  @SoloSesion()
  reconocimiento(
    @Param('id', ParseUUIDPipe) usuarioId: string,
    @Sesion() sesion: SesionActual,
  ): Promise<ReconocimientoPersona> {
    return this.valoracion.reconocimientoDe(usuarioId, sesion);
  }

  @Get('personas/:id/referencias')
  @SoloSesion()
  referenciasDeLaPersona(
    @Param('id', ParseUUIDPipe) usuarioId: string,
    @Sesion() sesion: SesionActual,
  ): Promise<ReferenciaPublicada[]> {
    return this.referencias.deLaPersona(usuarioId, sesion);
  }

  /** Moderación: solo RRHH, y queda registrado (Q17). */
  @Post('referencias/:id/ocultar')
  @RequierePermiso('referencias:moderar')
  ocultar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ocultarReferenciaSchema)) entrada: OcultarReferenciaInput,
    @Sesion() sesion: SesionActual,
  ): Promise<ReferenciaPublicada> {
    return this.referencias.ocultar(id, entrada, sesion);
  }

  /** Deshacer la moderación. También queda registrado: ocultar y mostrar pesan igual. */
  @Delete('referencias/:id/ocultar')
  @RequierePermiso('referencias:moderar')
  mostrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<ReferenciaPublicada> {
    return this.referencias.mostrar(id, sesion);
  }
}
