import { Injectable } from '@nestjs/common';
import type { DatosDeServicio, SupresionDeServicio } from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

const SERVICIO = 'learning-service';

/**
 * Los datos personales que guarda learning: lo que alguien dicta, a lo que va, cuándo puede, y
 * desde el Slice 8 lo que valoró y lo que otros escribieron sobre él (ADR-0009).
 *
 * El texto libre sobre una persona identificada es lo más delicado que guarda la plataforma, así
 * que entra entero en los dos lados: se exporta y se borra.
 */
@Injectable()
export class DatosPersonalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async exportar(sesion: SesionActual): Promise<DatosDeServicio> {
    const usuarioId = sesion.usuarioId;

    const [dicta, inscripciones, disponibilidad, valoraciones, escribi, recibi, tokens] =
      await Promise.all([
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
        this.prisma.valoracionTaller.findMany({
          where: { usuarioId },
          select: {
            asistio: true,
            createdAt: true,
            taller: { select: { nombre: true } },
            estrellas: { select: { dimension: true, estrellas: true } },
          },
        }),
        this.prisma.referencia.findMany({
          where: { autorId: usuarioId },
          select: { texto: true, createdAt: true, ocultaAt: true },
        }),
        this.prisma.referencia.findMany({
          where: { capacitadorId: usuarioId },
          select: { texto: true, createdAt: true, ocultaAt: true },
        }),
        this.prisma.token.findMany({
          where: { capacitadorId: usuarioId },
          select: { cantidad: true, createdAt: true, tallerId: true },
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
        loQueValore: valoraciones.map((valoracion) => ({
          taller: valoracion.taller.nombre,
          asisti: valoracion.asistio,
          estrellas: valoracion.estrellas,
          valoradoEl: valoracion.createdAt,
        })),
        referenciasQueEscribi: escribi,
        // Las escribió otra gente, pero son sobre esta persona: le corresponden igual.
        referenciasQueRecibi: recibi,
        misTokens: tokens,
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

    const [inscripciones, disponibilidad, valoraciones, referencias, tokens] =
      await this.prisma.$transaction([
        this.prisma.inscripcion.deleteMany({ where: { usuarioId } }),
        this.prisma.disponibilidad.deleteMany({ where: { usuarioId } }),
        // Las estrellas y la referencia cuelgan de la valoración y se van con ella (cascade).
        this.prisma.valoracionTaller.deleteMany({ where: { usuarioId } }),
        // Las que hablan de esta persona también: son texto sobre ella, aunque las escribiera
        // otro. Las que escribió ella ya se fueron con su valoración.
        this.prisma.referencia.deleteMany({ where: { capacitadorId: usuarioId } }),
        this.prisma.token.deleteMany({ where: { capacitadorId: usuarioId } }),
      ]);

    await this.auditoria.registrar({
      accion: 'ANONIMIZAR',
      entidad: 'DatosPersonales',
      entidadId: usuarioId,
      actorId: usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      camposModificados: [
        'inscripciones',
        'disponibilidad',
        'valoraciones',
        'referencias',
        'tokens',
      ],
      ip: sesion.ip,
    });

    return {
      servicio: SERVICIO,
      borrado: {
        inscripciones: inscripciones.count,
        franjasDeDisponibilidad: disponibilidad.count,
        valoracionesQueEscribiste: valoraciones.count,
        referenciasSobreTi: referencias.count,
        tokensDeReconocimiento: tokens.count,
      },
      conservado: [
        'Los talleres que dictaste, porque otras personas se inscribieron en ellos; ya no dicen quién eras.',
      ],
    };
  }
}
