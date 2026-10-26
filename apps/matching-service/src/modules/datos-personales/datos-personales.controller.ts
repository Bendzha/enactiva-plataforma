import { Controller, Delete, Get } from '@nestjs/common';
import { PREFIJO_INTERNO, type DatosDeServicio, type SupresionDeServicio } from '@enactiva/shared';
import { Sesion, SoloSesion, type SesionActual } from '@enactiva/service-kit';
import { DatosPersonalesService } from './datos-personales.service.js';

/**
 * Lo que el gateway le pide a este servicio para armar la exportación o la supresión completa
 * de una persona (Ley 21.719, ADR-0007).
 *
 * Va con el token de quien pide y el usuario sale de ahí, nunca de la URL: aunque el gateway se
 * equivocara, nadie puede exportar ni borrar los datos de otro.
 */
@Controller(`${PREFIJO_INTERNO}/datos-personales`)
export class DatosPersonalesController {
  constructor(private readonly datos: DatosPersonalesService) {}

  @Get()
  @SoloSesion()
  exportar(@Sesion() sesion: SesionActual): Promise<DatosDeServicio> {
    return this.datos.exportar(sesion);
  }

  @Delete()
  @SoloSesion()
  suprimir(@Sesion() sesion: SesionActual): Promise<SupresionDeServicio> {
    return this.datos.suprimir(sesion);
  }
}
