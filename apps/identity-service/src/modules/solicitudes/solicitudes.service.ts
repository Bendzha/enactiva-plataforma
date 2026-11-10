import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  normalizarNombre,
  type EstadoSolicitud,
  type MiSolicitud,
  type PedirRolEnsenarInput,
  type ProponerTallerInput,
  type RechazarSolicitudInput,
  type SolicitudParaRrhh,
  type TipoSolicitud,
} from '@enactiva/shared';
import { CacheEstadoSesion, type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Lo que se lee de la base para armar cualquiera de las dos vistas. */
const CAMPOS = {
  id: true,
  tipo: true,
  estado: true,
  tema: true,
  detalle: true,
  motivoRechazo: true,
  createdAt: true,
  resueltaAt: true,
} as const;

interface FilaSolicitud {
  id: string;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  tema: string | null;
  detalle: string;
  motivoRechazo: string | null;
  createdAt: Date;
  resueltaAt: Date | null;
}

function aMiSolicitud(fila: FilaSolicitud): MiSolicitud {
  return {
    id: fila.id,
    tipo: fila.tipo,
    estado: fila.estado,
    tema: fila.tema,
    detalle: fila.detalle,
    motivoRechazo: fila.motivoRechazo,
    createdAt: fila.createdAt.toISOString(),
    resueltaAt: fila.resueltaAt?.toISOString() ?? null,
  };
}

/**
 * Solicitudes a RRHH (SPEC §2, reunión del 2026-10-29).
 *
 * Desde que el catálogo de temas es solo de RRHH, quien enseña ya no puede crear el tema que
 * necesita: lo **propone**. Y quien solo aprende puede pedir el rol de quien enseña.
 *
 * Aprobar una propuesta de taller **solo cambia el estado**, porque la clienta pidió que RRHH cree
 * el taller y el tema a mano: *"mediante la solicitud el estado se aprueba y allí RRHH tiene que
 * crear el taller, el tema en sí"*.
 */
@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly estadoSesion: CacheEstadoSesion,
  ) {}

  /** Las mías, las más nuevas primero. Se ven en «Mi perfil». */
  async mias(sesion: SesionActual): Promise<MiSolicitud[]> {
    const filas = await this.prisma.acotado.solicitud.findMany({
      where: { solicitanteId: sesion.usuarioId },
      select: CAMPOS,
      orderBy: { createdAt: 'desc' },
    });
    return filas.map(aMiSolicitud);
  }

  /**
   * La bandeja de RRHH: las pendientes primero, porque son las que piden una decisión.
   * El acotado por empresa hace que una empresa no vea las de otra.
   */
  async paraRrhh(): Promise<SolicitudParaRrhh[]> {
    const filas = await this.prisma.acotado.solicitud.findMany({
      select: {
        ...CAMPOS,
        solicitante: { select: { id: true, nombre: true, apellido: true, email: true } },
        resueltaPor: { select: { nombre: true, apellido: true } },
      },
      orderBy: [{ estado: 'asc' }, { createdAt: 'desc' }],
    });

    return filas.map((fila) => ({
      ...aMiSolicitud(fila),
      solicitante: fila.solicitante,
      resueltaPor: fila.resueltaPor
        ? [fila.resueltaPor.nombre, fila.resueltaPor.apellido].filter(Boolean).join(' ')
        : null,
    }));
  }

  /**
   * Proponer un taller sobre un tema que no está en el catálogo.
   *
   * Si el tema **ya existe**, no hay nada que pedirle a RRHH: quien enseña puede publicar el
   * taller directamente, y se le dice así en vez de dejar la solicitud en una bandeja donde no
   * aporta nada.
   */
  async proponerTaller(datos: ProponerTallerInput, sesion: SesionActual): Promise<MiSolicitud> {
    const empresaId = this.empresaDe(sesion);
    const temaNormalizado = normalizarNombre(datos.tema);

    const existente = await this.prisma.acotado.tema.findFirst({
      where: { empresaId, nombreNormalizado: temaNormalizado },
      select: { nombre: true },
    });
    if (existente) {
      throw new ConflictException(
        `«${existente.nombre}» ya está en el catálogo: puedes publicar el taller directamente.`,
      );
    }

    return this.crear(
      {
        empresaId,
        solicitanteId: sesion.usuarioId,
        tipo: 'PROPUESTA_TALLER',
        tema: datos.tema,
        temaNormalizado,
        detalle: datos.detalle,
      },
      sesion,
      'Ya tienes una propuesta pendiente para ese tema.',
    );
  }

  /** Pedirle a RRHH el rol de quien enseña. */
  async pedirRolEnsenar(datos: PedirRolEnsenarInput, sesion: SesionActual): Promise<MiSolicitud> {
    const empresaId = this.empresaDe(sesion);

    if (sesion.roles.includes('CAPACITADOR')) {
      throw new ConflictException('Ya puedes enseñar: publica tu taller desde «Mis talleres».');
    }

    return this.crear(
      {
        empresaId,
        solicitanteId: sesion.usuarioId,
        tipo: 'CAMBIO_DE_ROL',
        tema: null,
        temaNormalizado: null,
        detalle: datos.detalle,
      },
      sesion,
      'Ya tienes una solicitud pendiente: RRHH la va a revisar.',
    );
  }

  /**
   * Aprobar.
   *
   * Dos comportamientos distintos a propósito:
   * - **Propuesta de taller:** solo cambia el estado. El taller y el tema los crea RRHH a mano,
   *   porque es quien controla el catálogo y la clienta lo pidió así.
   * - **Cambio de rol:** otorga el rol en la misma transacción. No hay nada que RRHH tenga que
   *   redactar después, y aprobar sin otorgar dejaría a la persona aprobada y sin el rol, sin que
   *   nada enlace las dos acciones.
   */
  async aprobar(id: string, sesion: SesionActual): Promise<MiSolicitud> {
    const solicitud = await this.pendiente(id);

    if (solicitud.tipo === 'CAMBIO_DE_ROL') {
      const actualizada = await this.prisma.$transaction(async (tx) => {
        await tx.usuarioRol.createMany({
          data: [{ usuarioId: solicitud.solicitanteId, rol: 'CAPACITADOR' }],
          skipDuplicates: true,
        });
        return tx.solicitud.update({
          where: { id },
          data: { estado: 'APROBADA', resueltaPorId: sesion.usuarioId, resueltaAt: new Date() },
          select: CAMPOS,
        });
      });

      // El rol nuevo no sirve de nada si su sesión sigue respondiendo con los roles viejos
      // durante los 30 s del caché (ADR-0007, D2).
      this.estadoSesion.invalidar(solicitud.solicitanteId);

      await this.auditar('APROBADA', solicitud, sesion, ['estado', 'roles']);
      return aMiSolicitud(actualizada);
    }

    const actualizada = await this.prisma.solicitud.update({
      where: { id },
      data: { estado: 'APROBADA', resueltaPorId: sesion.usuarioId, resueltaAt: new Date() },
      select: CAMPOS,
    });

    await this.auditar('APROBADA', solicitud, sesion, ['estado']);
    return aMiSolicitud(actualizada);
  }

  /** Rechazar. El motivo es opcional: la clienta dijo «con motivo o sin motivo». */
  async rechazar(
    id: string,
    datos: RechazarSolicitudInput,
    sesion: SesionActual,
  ): Promise<MiSolicitud> {
    const solicitud = await this.pendiente(id);

    const actualizada = await this.prisma.solicitud.update({
      where: { id },
      data: {
        estado: 'RECHAZADA',
        motivoRechazo: datos.motivo?.trim() || null,
        resueltaPorId: sesion.usuarioId,
        resueltaAt: new Date(),
      },
      select: CAMPOS,
    });

    await this.auditar('RECHAZADA', solicitud, sesion, ['estado', 'motivoRechazo']);
    return aMiSolicitud(actualizada);
  }

  /**
   * La solicitud, si es de la empresa de quien resuelve y todavía está pendiente.
   *
   * Se busca por el cliente acotado, así que una solicitud de otra empresa responde **404**: un
   * 403 confirmaría que existe, y con ella que alguien de otra empresa pidió algo.
   */
  private async pendiente(id: string) {
    const solicitud = await this.prisma.acotado.solicitud.findFirst({
      where: { id },
      select: { id: true, tipo: true, estado: true, empresaId: true, solicitanteId: true },
    });
    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }
    if (solicitud.estado !== 'PENDIENTE') {
      throw new ConflictException('Esa solicitud ya estaba resuelta');
    }
    return solicitud;
  }

  private async crear(
    datos: {
      empresaId: string;
      solicitanteId: string;
      tipo: TipoSolicitud;
      tema: string | null;
      temaNormalizado: string | null;
      detalle: string;
    },
    sesion: SesionActual,
    siEstaRepetida: string,
  ): Promise<MiSolicitud> {
    try {
      const solicitud = await this.prisma.solicitud.create({ data: datos, select: CAMPOS });

      await this.auditoria.registrar({
        accion: 'CREAR',
        entidad: 'Solicitud',
        entidadId: solicitud.id,
        actorId: sesion.usuarioId,
        actorRol: sesion.roles[0] ?? null,
        empresaId: datos.empresaId,
        camposModificados: ['tipo', 'tema', 'detalle'],
        ip: sesion.ip,
      });

      return aMiSolicitud(solicitud);
    } catch (error) {
      // Lo garantiza un índice parcial, no una comprobación previa: dos clics a la vez pasarían
      // por el medio de un `findFirst`.
      if (esIndiceRepetido(error)) {
        throw new ConflictException(siEstaRepetida);
      }
      throw error;
    }
  }

  private async auditar(
    resultado: 'APROBADA' | 'RECHAZADA',
    solicitud: { id: string; empresaId: string },
    sesion: SesionActual,
    camposModificados: string[],
  ): Promise<void> {
    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Solicitud',
      entidadId: solicitud.id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: solicitud.empresaId,
      camposModificados: [...camposModificados, resultado.toLowerCase()],
      ip: sesion.ip,
    });
  }

  /** Quien pide tiene que pertenecer a una empresa: el equipo de ENACTIVA no le pide nada a RRHH. */
  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}

function esIndiceRepetido(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
