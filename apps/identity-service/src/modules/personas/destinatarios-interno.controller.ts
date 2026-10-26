import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { PREFIJO_INTERNO, type DestinatarioInterno } from '@enactiva/shared';
import { SoloInterno } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Un taller no puede tener más inscritos que el cupo máximo, más el facilitador. */
const MAXIMO_DESTINATARIOS = 501;

/**
 * A dónde mandarle el correo a un grupo de personas (ADR-0007).
 *
 * Lo usa learning-service para los recordatorios de taller. Es la única consulta de este
 * servicio que **no va acotada por empresa**, y la razón es que quien llama es un reloj: no hay
 * una sesión de la que sacar la empresa. Por eso va protegida con el secreto compartido, igual
 * que las rutas anteriores al login, y el gateway nunca la expone.
 *
 * Devuelve solo el correo y el nombre de pila: lo justo para escribir "Hola Ana" y mandarlo.
 * Quien pregunta ya sabe a quién quiere escribirle —son los inscritos de su propio taller—,
 * así que esto no deja consultar la libreta de direcciones de nadie.
 */
@Controller(`${PREFIJO_INTERNO}/destinatarios`)
export class DestinatariosInternoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @SoloInterno()
  async porIds(@Query('ids') ids?: string): Promise<DestinatarioInterno[]> {
    const lista = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (lista.length === 0) return [];
    if (lista.length > MAXIMO_DESTINATARIOS) {
      throw new BadRequestException('Demasiados destinatarios en una sola consulta');
    }

    const personas = await this.prisma.usuario.findMany({
      where: { id: { in: lista }, estado: 'ACTIVO', email: { not: null } },
      select: { id: true, email: true, nombre: true },
    });

    return personas.map((persona) => ({
      id: persona.id,
      email: persona.email!,
      nombre: persona.nombre,
    }));
  }
}
