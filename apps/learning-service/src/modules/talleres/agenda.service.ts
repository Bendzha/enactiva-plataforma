import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Agenda, ItemAgenda } from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { IdentityCliente } from '../../identity.cliente.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Un taller de la agenda tal como sale de la base. */
interface TallerDeAgenda {
  id: string;
  temaId: string;
  capacitadorId: string;
  nombre: string;
  ubicacion: string;
  inicioAt: Date;
  finAt: Date;
  cupo: number;
  _count: { inscripciones: number };
}

/**
 * Lo que una persona tiene por delante: lo que dicta y a lo que va (acta 2026-09-29).
 *
 * Los dos papeles en la misma lista a propósito. Quien enseña también aprende —el facilitador
 * de un taller es participante de otro— y tener dos pantallas para "el martes a las 10 tengo
 * algo" sería pedirle a la gente que lleve la cuenta en su cabeza.
 */
@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityCliente,
  ) {}

  async mia(sesion: SesionActual): Promise<Agenda> {
    this.empresaDe(sesion);

    const talleres = await this.prisma.acotado.taller.findMany({
      where: {
        OR: [
          { capacitadorId: sesion.usuarioId },
          { inscripciones: { some: { usuarioId: sesion.usuarioId } } },
        ],
      },
      include: { _count: { select: { inscripciones: true } } },
      orderBy: { inicioAt: 'asc' },
    });
    if (talleres.length === 0) {
      return { proximos: [], pasados: [] };
    }

    const nombres = await this.identity.temasPorIds(talleres.map((taller) => taller.temaId));
    const ahora = Date.now();

    const items = talleres.map((taller: TallerDeAgenda) => ({
      item: this.aItem(taller, nombres, sesion),
      // El corte es el **término** del taller: mientras está ocurriendo sigue siendo lo próximo,
      // no historia. A las 10:30 de un taller de 10 a 12 nadie quiere buscarlo en el pasado.
      pasado: taller.finAt.getTime() < ahora,
    }));

    return {
      proximos: items.filter((fila) => !fila.pasado).map((fila) => fila.item),
      // El historial al revés: lo más reciente primero, que es lo que alguien busca.
      pasados: items
        .filter((fila) => fila.pasado)
        .map((fila) => fila.item)
        .reverse(),
    };
  }

  private aItem(
    taller: TallerDeAgenda,
    nombres: Map<string, string>,
    sesion: SesionActual,
  ): ItemAgenda {
    return {
      tallerId: taller.id,
      temaNombre: nombres.get(taller.temaId) ?? 'Tema no disponible',
      nombre: taller.nombre,
      ubicacion: taller.ubicacion,
      inicioAt: taller.inicioAt.toISOString(),
      finAt: taller.finAt.toISOString(),
      papel: taller.capacitadorId === sesion.usuarioId ? 'DICTO' : 'VOY',
      inscritos: taller._count.inscripciones,
      cupo: taller.cupo,
    };
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
