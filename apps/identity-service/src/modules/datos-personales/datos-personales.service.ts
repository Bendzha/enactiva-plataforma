import { ForbiddenException, Injectable } from '@nestjs/common';
import type { DatosDeServicio, SupresionDeServicio } from '@enactiva/shared';
import { CacheEstadoSesion, type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

const SERVICIO = 'identity-service';

/**
 * Los datos personales que guarda este servicio (Ley 21.719, SPEC §3.7).
 *
 * Todo sale de la sesión verificada: cada quien exporta y suprime **lo suyo**, y no hay forma de
 * pedir los datos de otra persona porque el usuario nunca viene en la petición. Por eso las
 * consultas filtran por `usuarioId` y no pasan por el cliente acotado por empresa: el límite
 * aquí es la persona, que es más estrecho que su empresa.
 */
@Injectable()
export class DatosPersonalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly estadoSesion: CacheEstadoSesion,
  ) {}

  async exportar(sesion: SesionActual): Promise<DatosDeServicio> {
    const usuarioId = sesion.usuarioId;

    const [usuario, roles, perfil, intereses, aceptaciones, temasCreados] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { id: usuarioId },
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          cargo: true,
          estado: true,
          nivelAdmin: true,
          createdAt: true,
          empresa: { select: { nombre: true } },
          area: { select: { nombre: true } },
        },
      }),
      this.prisma.usuarioRol.findMany({ where: { usuarioId }, select: { rol: true } }),
      this.prisma.perfilCorporativo.findUnique({
        where: { usuarioId },
        select: { interesesGenerales: true, updatedAt: true },
      }),
      this.prisma.perfilInteres.findMany({
        where: { usuarioId },
        select: { tipo: true, dimensiones: true, nivel: true, tema: { select: { nombre: true } } },
      }),
      this.prisma.aceptacionAviso.findMany({
        where: { usuarioId },
        select: { versionAviso: true, aceptadoAt: true },
      }),
      this.prisma.tema.findMany({ where: { creadoPorId: usuarioId }, select: { nombre: true } }),
    ]);

    await this.auditoria.registrar({
      accion: 'EXPORTAR',
      entidad: 'Usuario',
      entidadId: usuarioId,
      actorId: usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      ip: sesion.ip,
    });

    return {
      servicio: SERVICIO,
      contenido: {
        cuenta: usuario ? [usuario] : [],
        roles: roles.map((fila) => fila.rol),
        perfilCorporativo: perfil ? [perfil] : [],
        loQueEnsenoYQuieroAprender: intereses.map((interes) => ({
          tema: interes.tema.nombre,
          tipo: interes.tipo,
          dimensiones: interes.dimensiones,
          nivel: interes.nivel,
        })),
        avisosDePrivacidadAceptados: aceptaciones,
        temasQueAgregueAlCatalogo: temasCreados.map((tema) => tema.nombre),
      },
    };
  }

  /**
   * Anonimiza en vez de borrar la fila.
   *
   * La persona desaparece —sin nombre, sin correo, sin contraseña— pero su id sigue existiendo,
   * porque de él cuelgan cosas que son de otros: el taller al que fueron diez personas, el área
   * que creó, el registro de auditoría. Borrar la fila se llevaría por delante datos ajenos.
   */
  async suprimir(sesion: SesionActual): Promise<SupresionDeServicio> {
    const usuarioId = sesion.usuarioId;
    if (sesion.roles.includes('ADMIN_ENACTIVA')) {
      // Si el único Admin Principal se borra, nadie puede volver a administrar el piloto.
      throw new ForbiddenException(
        'Una cuenta del equipo ENACTIVA no se suprime desde aquí: pídelo al Admin Principal',
      );
    }

    const borrado = await this.prisma.$transaction(async (tx) => {
      const intereses = await tx.perfilInteres.deleteMany({ where: { usuarioId } });
      const perfil = await tx.perfilCorporativo.deleteMany({ where: { usuarioId } });
      const aceptaciones = await tx.aceptacionAviso.deleteMany({ where: { usuarioId } });
      // Los tokens se van enteros: cerrar la sesión es parte de suprimir la cuenta.
      const tokens = await tx.tokenAcceso.deleteMany({ where: { usuarioId } });
      // Los temas del catálogo quedan, pero sin decir quién los creó.
      await tx.tema.updateMany({ where: { creadoPorId: usuarioId }, data: { creadoPorId: null } });

      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          email: null,
          passwordHash: null,
          nombre: null,
          apellido: null,
          cargo: null,
          areaId: null,
          estado: 'ANONIMIZADO',
          anonimizadoAt: new Date(),
        },
      });

      return {
        declaracionesDePerfil: intereses.count,
        perfilCorporativo: perfil.count,
        avisosAceptados: aceptaciones.count,
        sesionesYTokens: tokens.count,
        cuenta: 1,
      };
    });

    // Sin esto el token seguiría sirviendo hasta 30 segundos, lo que dura el caché de sesión.
    // Los otros dos servicios tienen su propio caché y no se puede alcanzar desde aquí, pero
    // para cuando vence ya no les queda nada de esta persona que mostrar (ADR-0007, D2).
    this.estadoSesion.invalidar(usuarioId);

    await this.auditoria.registrar({
      accion: 'ANONIMIZAR',
      entidad: 'Usuario',
      entidadId: usuarioId,
      actorId: usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      camposModificados: ['email', 'passwordHash', 'nombre', 'apellido', 'cargo', 'estado'],
      ip: sesion.ip,
    });

    return {
      servicio: SERVICIO,
      borrado,
      conservado: [
        'El registro de auditoría, que es append-only por ley y ya no guarda tu nombre ni tu correo.',
        'Los temas que agregaste al catálogo de tu empresa, sin decir que fuiste tú.',
      ],
    };
  }
}
