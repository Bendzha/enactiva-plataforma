import { ConflictException, Injectable } from '@nestjs/common';
import {
  documentosPendientes,
  VERSIONES_LEGALES,
  type AceptarDocumentosInput,
  type DocumentoLegal,
  type EstadoAceptaciones,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/**
 * Aceptación de los documentos legales (SPEC §3.7, Q21).
 *
 * Son dos —el aviso de privacidad y los términos— y cada uno lleva su versión. Si el texto
 * cambia de forma relevante se sube su versión, y entonces hay que volver a aceptarlo: hasta
 * ahora el aviso se aceptaba una sola vez al activar la cuenta y una versión nueva no la veía
 * nadie.
 */
@Injectable()
export class LegalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async estado(sesion: SesionActual): Promise<EstadoAceptaciones> {
    const filas = await this.prisma.aceptacionAviso.findMany({
      where: { usuarioId: sesion.usuarioId },
      select: { documento: true, version: true, aceptadoAt: true },
      orderBy: { aceptadoAt: 'desc' },
    });

    return {
      aceptadas: filas.map((fila) => ({
        documento: fila.documento,
        version: fila.version,
        aceptadoAt: fila.aceptadoAt.toISOString(),
      })),
      // La misma función pura que usa la web: una sola definición de «pendiente».
      pendientes: documentosPendientes(filas),
    };
  }

  /**
   * Deja constancia de que esta persona aceptó estos documentos **en su versión vigente**.
   *
   * La versión la pone el servidor y nunca el cliente: si viniera en la petición, cualquiera
   * podría decir que aceptó una versión que no leyó, y el registro dejaría de probar nada.
   */
  async aceptar(datos: AceptarDocumentosInput, sesion: SesionActual): Promise<EstadoAceptaciones> {
    const yaAceptados = await this.prisma.aceptacionAviso.findMany({
      where: { usuarioId: sesion.usuarioId },
      select: { documento: true, version: true },
    });
    const pendientes = documentosPendientes(yaAceptados);

    const nuevos = datos.documentos.filter((documento) => pendientes.includes(documento));
    if (nuevos.length === 0) {
      throw new ConflictException('Ya aceptaste la versión vigente de esos documentos');
    }

    await this.prisma.aceptacionAviso.createMany({
      data: nuevos.map((documento) => ({
        usuarioId: sesion.usuarioId,
        documento,
        version: VERSIONES_LEGALES[documento],
        ip: sesion.ip ?? null,
      })),
      // Dos pestañas abiertas aceptando a la vez no son dos hechos distintos.
      skipDuplicates: true,
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'AceptacionAviso',
      entidadId: sesion.usuarioId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId: sesion.empresaId,
      camposModificados: nuevos.map((documento: DocumentoLegal) => `documento.${documento}`),
      ip: sesion.ip,
    });

    return this.estado(sesion);
  }
}
