import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PREFIJO_INTERNO, type PersonaConContacto } from '@enactiva/shared';
import { SoloSesion } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Un taller no tiene más inscritos que su cupo máximo. */
const MAXIMO_PERSONAS = 500;

/**
 * Nombre y correo de un grupo de personas, para que learning pueda armar la lista de
 * asistencia de un taller (ADR-0007).
 *
 * Es la única ruta que saca correos de este servicio con el token de una persona, y existe
 * porque la clienta lo pidió: quien dicta necesita reconocer a su gente para pasar lista. Va
 * con ese token, así que el acotado por empresa decide qué existe —alguien de otra
 * organización simplemente no vuelve— y learning solo la llama con los inscritos del taller.
 *
 * No devuelve cargo, área ni perfil: solo lo que hace falta para identificar a alguien en una
 * sala (minimización, Ley 21.719).
 */
@Controller(`${PREFIJO_INTERNO}/personas`)
export class PersonasInternoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @SoloSesion()
  async porIds(@Query('ids') ids?: string): Promise<PersonaConContacto[]> {
    const lista = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (lista.length > MAXIMO_PERSONAS) {
      throw new BadRequestException('Demasiadas personas en una sola consulta');
    }
    if (lista.length === 0) return [];

    return this.prisma.acotado.usuario.findMany({
      where: { id: { in: lista } },
      select: { id: true, nombre: true, apellido: true, email: true },
    });
  }
}
