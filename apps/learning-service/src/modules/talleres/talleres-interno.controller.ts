import { Controller, Get } from '@nestjs/common';
import { PREFIJO_INTERNO, type TallerAbierto } from '@enactiva/shared';
import { Sesion, SoloSesion, type SesionActual } from '@enactiva/service-kit';
import { TalleresService } from './talleres.service.js';

/**
 * Lo que matching-service necesita de learning para armar el mazo (ADR-0007).
 *
 * El filtro vive aquí y no en matching a propósito: las reglas de la fecha y del cupo son del
 * servicio dueño del taller. matching ordena lo que recibe, no decide qué está abierto.
 */
@Controller(`${PREFIJO_INTERNO}/talleres`)
export class TalleresInternoController {
  constructor(private readonly talleres: TalleresService) {}

  @Get('abiertos')
  @SoloSesion()
  abiertos(@Sesion() sesion: SesionActual): Promise<TallerAbierto[]> {
    return this.talleres.abiertosPara(sesion);
  }
}
