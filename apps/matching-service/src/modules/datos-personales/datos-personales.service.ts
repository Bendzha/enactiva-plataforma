import { Injectable } from '@nestjs/common';
import type { DatosDeServicio, SupresionDeServicio } from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

const SERVICIO = 'matching-service';

/** Lo que guarda matching de una persona: qué decidió sobre cada tarjeta del mazo. */
@Injectable()
export class DatosPersonalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async exportar(sesion: SesionActual): Promise<DatosDeServicio> {
    const decisiones = await this.prisma.match.findMany({
      where: { estudianteId: sesion.usuarioId },
      select: { decision: true, score: true, decididoAt: true, tallerId: true },
    });

    await this.auditoria.registrar({
      accion: 'EXPORTAR',
      entidad: 'DatosPersonales',
      entidadId: sesion.usuarioId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      ip: sesion.ip,
    });

    return { servicio: SERVICIO, contenido: { misDecisionesDelMazo: decisiones } };
  }

  /**
   * Las decisiones se borran enteras: son de la persona y de nadie más. El score con el que se
   * tomaron servía para ajustar los pesos del matching, pero ese uso no sobrevive a que alguien
   * pida que lo borren.
   */
  async suprimir(sesion: SesionActual): Promise<SupresionDeServicio> {
    const borradas = await this.prisma.match.deleteMany({
      where: { estudianteId: sesion.usuarioId },
    });

    await this.auditoria.registrar({
      accion: 'ANONIMIZAR',
      entidad: 'DatosPersonales',
      entidadId: sesion.usuarioId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      camposModificados: ['matches'],
      ip: sesion.ip,
    });

    return {
      servicio: SERVICIO,
      borrado: { decisionesDelMazo: borradas.count },
      conservado: [],
    };
  }
}
