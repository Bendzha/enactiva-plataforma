import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PREFIJO_INTERNO, type ValoracionDeFacilitador } from '@enactiva/shared';
import { SoloSesion } from '@enactiva/service-kit';
import { ValoracionService } from './valoracion.service.js';

/** Tantos facilitadores como talleres puede traer un mazo. */
const MAXIMO_FACILITADORES = 100;

/**
 * El promedio de estrellas que matching necesita para el cuarto criterio del score (ADR-0009).
 *
 * Va con el token de quien mira el mazo, igual que el resto de las llamadas entre servicios: el
 * acotado por empresa decide qué existe, y un facilitador de otra organización no vuelve.
 *
 * Devuelve `null` para quien todavía no junta suficientes valoraciones, y el score reparte ese
 * peso entre los demás criterios. El umbral vive en `shared` para que este servicio y matching
 * no puedan discrepar sobre cuándo cuenta.
 */
@Controller(`${PREFIJO_INTERNO}/valoraciones`)
export class ValoracionInternoController {
  constructor(private readonly valoracion: ValoracionService) {}

  @Get('facilitadores')
  @SoloSesion()
  async facilitadores(@Query('ids') ids?: string): Promise<ValoracionDeFacilitador[]> {
    const lista = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (lista.length > MAXIMO_FACILITADORES) {
      throw new BadRequestException('Demasiados facilitadores en una sola consulta');
    }
    if (lista.length === 0) return [];

    const promedios = await this.valoracion.promediosDe(lista);
    return [...promedios].map(([capacitadorId, promedio]) => ({ capacitadorId, promedio }));
  }
}
