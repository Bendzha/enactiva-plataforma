import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  DIAS_SEMANA,
  type FranjaDisponibilidad,
  type GuardarDisponibilidadInput,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Orden de la semana, para listar de lunes a domingo y no alfabéticamente. */
const ORDEN_DIA = new Map(DIAS_SEMANA.map((dia, indice) => [dia, indice]));

/**
 * Cuándo puede enseñar cada facilitador (acta 2026-09-29).
 *
 * Se guarda la semana completa de una vez: quien la edita ve todas sus franjas juntas, y mandar
 * la lista entera evita quedar a medio camino entre dos estados.
 */
@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async mia(sesion: SesionActual): Promise<FranjaDisponibilidad[]> {
    this.empresaDe(sesion);
    const franjas = await this.prisma.acotado.disponibilidad.findMany({
      where: { usuarioId: sesion.usuarioId },
      select: { dia: true, horaInicio: true, horaFin: true },
    });

    // Las horas van en HH:MM con cero a la izquierda, así que ordenarlas como texto las ordena bien.
    return franjas.sort(
      (a, b) =>
        ORDEN_DIA.get(a.dia)! - ORDEN_DIA.get(b.dia)! || a.horaInicio.localeCompare(b.horaInicio),
    );
  }

  async guardar(
    datos: GuardarDisponibilidadInput,
    sesion: SesionActual,
  ): Promise<FranjaDisponibilidad[]> {
    const empresaId = this.empresaDe(sesion);

    // Cliente sin acotar y filtros escritos a mano: el borrado y la creación van en una sola
    // transacción por lotes, donde la extensión de Prisma no interviene. El usuario sale de la
    // sesión verificada y la empresa también, así que el aislamiento no depende de la extensión.
    await this.prisma.$transaction([
      this.prisma.disponibilidad.deleteMany({ where: { usuarioId: sesion.usuarioId, empresaId } }),
      this.prisma.disponibilidad.createMany({
        data: datos.franjas.map((franja) => ({
          empresaId,
          usuarioId: sesion.usuarioId,
          dia: franja.dia,
          horaInicio: franja.horaInicio,
          horaFin: franja.horaFin,
        })),
      }),
    ]);

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Disponibilidad',
      entidadId: sesion.usuarioId,
      actorId: sesion.usuarioId,
      actorRol: 'CAPACITADOR',
      empresaId,
      camposModificados: ['franjas'],
      ip: sesion.ip,
    });

    return this.mia(sesion);
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
