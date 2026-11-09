import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from '@nestjs/common';
import { PREFIJO_INTERNO, type TallerAbierto, type TallerInterno } from '@enactiva/shared';
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

  /**
   * Un taller puntual, para que matching sepa si ya terminó antes de aceptar una puntuación.
   *
   * Va después de 'abiertos' porque Nest resuelve las rutas en orden y ':id' se comería esa
   * palabra. Acotado por empresa con el token de quien pide: uno de otra organización no vuelve.
   */
  @Get(':id')
  @SoloSesion()
  async porId(
    @Param('id', ParseUUIDPipe) id: string,
    @Sesion() sesion: SesionActual,
  ): Promise<TallerInterno> {
    const taller = await this.talleres.internoPorId(id, sesion);
    if (!taller) {
      throw new NotFoundException('Ese taller no existe en tu empresa');
    }
    return taller;
  }
}
