import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CrearTallerInput, EditarTallerInput, TallerResumen } from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { IdentityCliente } from '../../identity.cliente.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Taller tal como sale de la base, con lo que hace falta para armar el resumen. */
interface TallerConCuentas {
  id: string;
  temaId: string;
  capacitadorId: string;
  nombre: string;
  objetivo: string;
  resultadosEsperados: string;
  ubicacion: string;
  inicioAt: Date;
  finAt: Date;
  cupo: number;
  _count: { inscripciones: number };
  inscripciones: { id: string }[];
}

const CAMPOS_FICHA = [
  'nombre',
  'objetivo',
  'resultadosEsperados',
  'ubicacion',
  'inicioAt',
  'finAt',
  'cupo',
];

/**
 * Talleres convocados (SPEC §3.2, ADR-0008).
 *
 * El taller ocurre una vez y en persona: no hay etapas ni contenidos (ADR-0010). Lo único que
 * decide si todavía se puede entrar son **la fecha y el cupo**.
 */
@Injectable()
export class TalleresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly identity: IdentityCliente,
  ) {}

  /** Los que yo dicto, incluidos los que ya pasaron: es mi historial. */
  async mios(sesion: SesionActual): Promise<TallerResumen[]> {
    this.empresaDe(sesion);
    const talleres = await this.prisma.acotado.taller.findMany({
      where: { capacitadorId: sesion.usuarioId },
      ...this.conCuentas(sesion.usuarioId),
      orderBy: { inicioAt: 'desc' },
    });
    return this.aResumenes(talleres, sesion);
  }

  /** Los de mi empresa que todavía no ocurren: es lo que alguien puede mirar para inscribirse. */
  async proximos(sesion: SesionActual): Promise<TallerResumen[]> {
    this.empresaDe(sesion);
    const talleres = await this.prisma.acotado.taller.findMany({
      where: { inicioAt: { gte: new Date() } },
      ...this.conCuentas(sesion.usuarioId),
      orderBy: { inicioAt: 'asc' },
    });
    return this.aResumenes(talleres, sesion);
  }

  async crear(datos: CrearTallerInput, sesion: SesionActual): Promise<TallerResumen> {
    const empresaId = this.empresaDe(sesion);
    const inicioAt = new Date(datos.inicioAt);

    if (inicioAt.getTime() <= Date.now()) {
      throw new BadRequestException('El taller tiene que empezar en el futuro');
    }
    // El tema lo valida identity con el token de quien publica: uno de otra empresa no existe.
    await this.nombreDelTema(datos.temaId);

    const taller = await this.prisma.acotado.taller.create({
      data: {
        empresaId,
        capacitadorId: sesion.usuarioId,
        temaId: datos.temaId,
        nombre: datos.nombre,
        objetivo: datos.objetivo,
        resultadosEsperados: datos.resultadosEsperados,
        ubicacion: datos.ubicacion,
        inicioAt,
        finAt: new Date(datos.finAt),
        cupo: datos.cupo,
      },
      ...this.conCuentas(sesion.usuarioId),
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'Taller',
      entidadId: taller.id,
      actorId: sesion.usuarioId,
      actorRol: 'CAPACITADOR',
      empresaId,
      camposModificados: ['temaId', ...CAMPOS_FICHA],
      ip: sesion.ip,
    });

    return (await this.aResumenes([taller], sesion))[0]!;
  }

  async editar(id: string, datos: EditarTallerInput, sesion: SesionActual): Promise<TallerResumen> {
    const empresaId = this.empresaDe(sesion);
    const taller = await this.propio(id, sesion);

    if (taller.inicioAt.getTime() <= Date.now()) {
      throw new ConflictException('El taller ya empezó: su ficha no se puede cambiar');
    }
    // Bajar el cupo por debajo de la gente ya inscrita dejaría a alguien fuera sin avisarle.
    if (datos.cupo < taller._count.inscripciones) {
      throw new ConflictException(
        `Ya hay ${taller._count.inscripciones} personas inscritas: el cupo no puede ser menor`,
      );
    }

    const actualizado = await this.prisma.acotado.taller.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        objetivo: datos.objetivo,
        resultadosEsperados: datos.resultadosEsperados,
        ubicacion: datos.ubicacion,
        inicioAt: new Date(datos.inicioAt),
        finAt: new Date(datos.finAt),
        cupo: datos.cupo,
      },
      ...this.conCuentas(sesion.usuarioId),
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Taller',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: 'CAPACITADOR',
      empresaId,
      camposModificados: CAMPOS_FICHA,
      ip: sesion.ip,
    });

    return (await this.aResumenes([actualizado], sesion))[0]!;
  }

  /**
   * Inscribirse respetando el cupo.
   *
   * Va en una transacción serializable porque contar y crear son dos pasos: con dos personas
   * entrando al mismo tiempo al último lugar, ambas verían cupo libre. Dentro de la transacción
   * los filtros por empresa van **escritos a mano** y no delegados al acotado: es la diferencia
   * entre que el aislamiento dependa de una extensión de Prisma o de la consulta misma.
   */
  async inscribir(tallerId: string, sesion: SesionActual): Promise<TallerResumen> {
    const empresaId = this.empresaDe(sesion);

    await this.prisma.$transaction(
      async (tx) => {
        const taller = await tx.taller.findFirst({
          where: { id: tallerId, empresaId },
          include: { _count: { select: { inscripciones: true } } },
        });
        if (!taller) {
          throw new NotFoundException('Taller no encontrado');
        }
        if (taller.capacitadorId === sesion.usuarioId) {
          throw new BadRequestException('Es tu propio taller: no hace falta que te inscribas');
        }
        if (taller.inicioAt.getTime() <= Date.now()) {
          throw new ConflictException('El taller ya empezó');
        }
        if (taller._count.inscripciones >= taller.cupo) {
          throw new ConflictException('El taller ya no tiene cupos');
        }

        const yaEstaba = await tx.inscripcion.findUnique({
          where: { tallerId_usuarioId: { tallerId, usuarioId: sesion.usuarioId } },
        });
        if (yaEstaba) {
          throw new ConflictException('Ya estás inscrito en este taller');
        }

        await tx.inscripcion.create({
          data: { empresaId, tallerId, usuarioId: sesion.usuarioId },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'Inscripcion',
      entidadId: tallerId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['tallerId'],
      ip: sesion.ip,
    });

    return this.uno(tallerId, sesion);
  }

  async cancelar(tallerId: string, sesion: SesionActual): Promise<TallerResumen> {
    const empresaId = this.empresaDe(sesion);

    const inscripcion = await this.prisma.acotado.inscripcion.findFirst({
      where: { tallerId, usuarioId: sesion.usuarioId },
      include: { taller: { select: { inicioAt: true } } },
    });
    if (!inscripcion) {
      throw new NotFoundException('No estás inscrito en este taller');
    }
    if (inscripcion.taller.inicioAt.getTime() <= Date.now()) {
      throw new ConflictException('El taller ya empezó: tu inscripción queda como registro');
    }

    await this.prisma.acotado.inscripcion.delete({ where: { id: inscripcion.id } });

    await this.auditoria.registrar({
      accion: 'ELIMINAR',
      entidad: 'Inscripcion',
      entidadId: tallerId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      ip: sesion.ip,
    });

    return this.uno(tallerId, sesion);
  }

  private async uno(id: string, sesion: SesionActual): Promise<TallerResumen> {
    const taller = await this.prisma.acotado.taller.findUnique({
      where: { id },
      ...this.conCuentas(sesion.usuarioId),
    });
    if (!taller) {
      throw new NotFoundException('Taller no encontrado');
    }
    return (await this.aResumenes([taller], sesion))[0]!;
  }

  /** Existe, es de mi empresa y lo dicto yo. 404 y no 403: no se confirma lo que no es tuyo. */
  private async propio(id: string, sesion: SesionActual): Promise<TallerConCuentas> {
    const taller = await this.prisma.acotado.taller.findUnique({
      where: { id },
      ...this.conCuentas(sesion.usuarioId),
    });
    if (!taller || taller.capacitadorId !== sesion.usuarioId) {
      throw new NotFoundException('Taller no encontrado');
    }
    return taller;
  }

  /** Cuántos inscritos tiene, y si quien pregunta es uno de ellos. */
  private conCuentas(usuarioId: string) {
    return {
      include: {
        _count: { select: { inscripciones: true } },
        inscripciones: { where: { usuarioId }, select: { id: true } },
      },
    };
  }

  private async aResumenes(
    talleres: TallerConCuentas[],
    sesion: SesionActual,
  ): Promise<TallerResumen[]> {
    const nombres = await this.identity.temasPorIds(talleres.map((t) => t.temaId));
    const ahora = Date.now();

    return talleres.map((taller) => ({
      id: taller.id,
      temaId: taller.temaId,
      temaNombre: nombres.get(taller.temaId) ?? 'Tema no disponible',
      capacitadorId: taller.capacitadorId,
      nombre: taller.nombre,
      objetivo: taller.objetivo,
      resultadosEsperados: taller.resultadosEsperados,
      ubicacion: taller.ubicacion,
      inicioAt: taller.inicioAt.toISOString(),
      finAt: taller.finAt.toISOString(),
      cupo: taller.cupo,
      inscritos: taller._count.inscripciones,
      cuposDisponibles: Math.max(0, taller.cupo - taller._count.inscripciones),
      empezado: taller.inicioAt.getTime() <= ahora,
      esMio: taller.capacitadorId === sesion.usuarioId,
      inscrito: taller.inscripciones.length > 0,
    }));
  }

  private async nombreDelTema(temaId: string): Promise<string> {
    const nombres = await this.identity.temasPorIds([temaId]);
    const nombre = nombres.get(temaId);
    if (!nombre) {
      throw new NotFoundException('Tema no encontrado en el catálogo de tu empresa');
    }
    return nombre;
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
