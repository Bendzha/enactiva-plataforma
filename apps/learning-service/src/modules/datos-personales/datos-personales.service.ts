import { Injectable } from '@nestjs/common';
import type { DatosDeServicio, SupresionDeServicio } from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

const SERVICIO = 'learning-service';

/** Los datos personales que guarda learning: lo que alguien dicta, a lo que va y cuándo puede. */
@Injectable()
export class DatosPersonalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async exportar(sesion: SesionActual): Promise<DatosDeServicio> {
    const usuarioId = sesion.usuarioId;

    const [dicta, inscripciones, disponibilidad] = await Promise.all([
      this.prisma.taller.findMany({
        where: { capacitadorId: usuarioId },
        select: { nombre: true, ubicacion: true, inicioAt: true, cupo: true },
      }),
      this.prisma.inscripcion.findMany({
        where: { usuarioId },
        select: { createdAt: true, taller: { select: { nombre: true, inicioAt: true } } },
      }),
      this.prisma.disponibilidad.findMany({
        where: { usuarioId },
        select: { dia: true, horaInicio: true, horaFin: true },
      }),
    ]);

    await this.auditoria.registrar({
      accion: 'EXPORTAR',
      entidad: 'DatosPersonales',
      entidadId: usuarioId,
      actorId: usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      ip: sesion.ip,
    });

    return {
      servicio: SERVICIO,
      contenido: {
        talleresQueDicto: dicta,
        talleresALosQueMeInscribi: inscripciones.map((inscripcion) => ({
          taller: inscripcion.taller.nombre,
          cuando: inscripcion.taller.inicioAt,
          meInscribiEl: inscripcion.createdAt,
        })),
        miDisponibilidad: disponibilidad,
      },
    };
  }

  /**
   * Los talleres que la persona dictó **no se borran**: otra gente se inscribió en ellos y esa
   * es su historia también. Quedan apuntando a una cuenta ya anonimizada, que es justo lo que
   * la anonimización busca.
   */
  async suprimir(sesion: SesionActual): Promise<SupresionDeServicio> {
    const usuarioId = sesion.usuarioId;

    const [inscripciones, disponibilidad] = await this.prisma.$transaction([
      this.prisma.inscripcion.deleteMany({ where: { usuarioId } }),
      this.prisma.disponibilidad.deleteMany({ where: { usuarioId } }),
    ]);

    await this.auditoria.registrar({
      accion: 'ANONIMIZAR',
      entidad: 'DatosPersonales',
      entidadId: usuarioId,
      actorId: usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      camposModificados: ['inscripciones', 'disponibilidad'],
      ip: sesion.ip,
    });

    return {
      servicio: SERVICIO,
      borrado: {
        inscripciones: inscripciones.count,
        franjasDeDisponibilidad: disponibilidad.count,
      },
      conservado: [
        'Los talleres que dictaste, porque otras personas se inscribieron en ellos; ya no dicen quién eras.',
      ],
    };
  }
}
