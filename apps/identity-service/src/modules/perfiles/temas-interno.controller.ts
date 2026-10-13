import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { MAXIMO_TEMAS_INTERNOS, PREFIJO_INTERNO, type TemaInterno } from '@enactiva/shared';
import { SoloSesion } from '@enactiva/service-kit';
import { TemasService } from './temas.service.js';

/**
 * Lo que otros servicios pueden preguntar sobre el catálogo de temas (ADR-0007).
 *
 * learning-service guarda `temaId` y necesita el nombre para mostrarlo. Va con el token de la
 * persona que originó la petición, así que el acotado por empresa decide qué temas existen para
 * ella: un id de otra empresa simplemente no vuelve en la respuesta.
 */
@Controller(`${PREFIJO_INTERNO}/temas`)
export class TemasInternoController {
  constructor(private readonly temas: TemasService) {}

  @Get()
  @SoloSesion()
  porIds(@Query('ids') ids?: string): Promise<TemaInterno[]> {
    const lista = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (lista.length === 0) return Promise.resolve([]);
    if (lista.length > MAXIMO_TEMAS_INTERNOS) {
      throw new BadRequestException('Demasiados temas en una sola consulta');
    }
    return this.temas.porIds(lista);
  }
}
