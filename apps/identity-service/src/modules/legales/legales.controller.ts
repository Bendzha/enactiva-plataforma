import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  aceptarDocumentosSchema,
  type AceptarDocumentosInput,
  type EstadoAceptaciones,
} from '@enactiva/shared';
import { Sesion, SoloSesion, ZodValidationPipe, type SesionActual } from '@enactiva/service-kit';
import { LegalesService } from './legales.service.js';

/**
 * Los documentos que cada persona aceptó, y los que le faltan (SPEC §3.7, Q21).
 *
 * Va con `@SoloSesion()` y no con un permiso: aceptar los términos es de cualquiera que entre,
 * incluido quien administra.
 */
@Controller('mis-aceptaciones')
export class LegalesController {
  constructor(private readonly legales: LegalesService) {}

  @Get()
  @SoloSesion()
  estado(@Sesion() sesion: SesionActual): Promise<EstadoAceptaciones> {
    return this.legales.estado(sesion);
  }

  @Post()
  @SoloSesion()
  aceptar(
    @Body(new ZodValidationPipe(aceptarDocumentosSchema)) datos: AceptarDocumentosInput,
    @Sesion() sesion: SesionActual,
  ): Promise<EstadoAceptaciones> {
    return this.legales.aceptar(datos, sesion);
  }
}
