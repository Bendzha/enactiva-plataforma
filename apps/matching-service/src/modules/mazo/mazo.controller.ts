import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  decidirSchema,
  type DecidirInput,
  type ResultadoDecision,
  type TarjetaMazo,
} from '@enactiva/shared';
import { Sesion, SoloSesion, ZodValidationPipe, type SesionActual } from '@enactiva/service-kit';
import { DecisionService } from './decision.service.js';
import { MazoService } from './mazo.service.js';

@Controller('mazo')
export class MazoController {
  constructor(
    private readonly mazo: MazoService,
    private readonly decision: DecisionService,
  ) {}

  /** Las tarjetas de esta persona, ordenadas por afinidad. `buscar` filtra por tema. */
  @Get()
  @SoloSesion()
  mio(@Sesion() sesion: SesionActual, @Query('buscar') buscar?: string): Promise<TarjetaMazo[]> {
    return this.mazo.paraMi(sesion, buscar);
  }

  @Post(':tallerId/decision')
  @SoloSesion()
  decidir(
    @Param('tallerId', ParseUUIDPipe) tallerId: string,
    @Body(new ZodValidationPipe(decidirSchema)) datos: DecidirInput,
    @Sesion() sesion: SesionActual,
  ): Promise<ResultadoDecision> {
    return this.decision.decidir(tallerId, datos.decision, sesion);
  }
}
