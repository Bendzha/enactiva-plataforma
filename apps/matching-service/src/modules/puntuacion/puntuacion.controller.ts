import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  puntuarMatchSchema,
  type MatchPuntuado,
  type MetricasDeMatches,
  type PuntuarMatchInput,
} from '@enactiva/shared';
import {
  RequierePermiso,
  Sesion,
  SoloSesion,
  ZodValidationPipe,
  type SesionActual,
} from '@enactiva/service-kit';
import { PuntuacionService } from './puntuacion.service.js';

/**
 * Las cuatro preguntas sobre el match, después de la primera reunión (SPEC §3.5).
 *
 * Están separadas de las estrellas a propósito: aquellas dicen si el taller estuvo bueno, estas
 * si el emparejamiento funcionó, que es lo que la clienta quiere entender (ADR-0009).
 */
@Controller()
export class PuntuacionController {
  constructor(private readonly puntuacion: PuntuacionService) {}

  @Post('talleres/:id/puntuacion')
  @SoloSesion()
  puntuar(
    @Param('id', ParseUUIDPipe) tallerId: string,
    @Body(new ZodValidationPipe(puntuarMatchSchema)) entrada: PuntuarMatchInput,
    @Sesion() sesion: SesionActual,
  ): Promise<MatchPuntuado> {
    return this.puntuacion.puntuar(tallerId, entrada, sesion);
  }

  @Get('talleres/:id/puntuacion')
  @SoloSesion()
  delTaller(
    @Param('id', ParseUUIDPipe) tallerId: string,
    @Sesion() sesion: SesionActual,
  ): Promise<MatchPuntuado | null> {
    return this.puntuacion.delTaller(tallerId, sesion);
  }

  /** Los talleres míos que ya terminaron y todavía no puntué. */
  @Get('puntuaciones/pendientes')
  @SoloSesion()
  pendientes(@Sesion() sesion: SesionActual): Promise<string[]> {
    return this.puntuacion.pendientesDe(sesion);
  }

  /** El panel de RRHH: si los matches de la empresa funcionaron. Siempre agregado. */
  @Get('metricas/matches')
  @RequierePermiso('personas:gestionar')
  metricas(@Sesion() sesion: SesionActual): Promise<MetricasDeMatches> {
    return this.puntuacion.metricas(sesion);
  }
}
