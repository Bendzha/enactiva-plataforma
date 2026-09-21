import { ConflictException, GoneException, Injectable } from '@nestjs/common';
import {
  AVISO_PRIVACIDAD_VERSION,
  type AceptarInvitacionInput,
  type EstadoInvitacion,
} from '@enactiva/shared';
import { hashPassword } from '../../common/password.js';
import { hashToken } from '../../common/tokens.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService, type SesionEmitida } from '../auth/auth.service.js';

@Injectable()
export class InvitacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  /** Datos mínimos para que la persona sepa qué cuenta está activando. */
  async estado(token: string): Promise<EstadoInvitacion> {
    const invitacion = await this.buscarVigente(token);

    return {
      email: invitacion.usuario.email ?? '',
      nombreEmpresa: invitacion.usuario.empresa?.nombre ?? null,
      versionAviso: AVISO_PRIVACIDAD_VERSION,
    };
  }

  /**
   * Completa la cuenta: nombre, contraseña y aceptación del aviso de privacidad.
   * Deja la sesión iniciada para que la persona entre sin escribir sus datos de nuevo.
   */
  async aceptar(datos: AceptarInvitacionInput, ip?: string | null): Promise<SesionEmitida> {
    const invitacion = await this.buscarVigente(datos.token);
    const passwordHash = await hashPassword(datos.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: invitacion.usuarioId },
        data: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          passwordHash,
          estado: 'ACTIVO',
        },
      });

      await tx.tokenAcceso.update({
        where: { id: invitacion.id },
        data: { usadoAt: new Date() },
      });

      await tx.aceptacionAviso.create({
        data: {
          usuarioId: invitacion.usuarioId,
          versionAviso: AVISO_PRIVACIDAD_VERSION,
          ip: ip ?? null,
        },
      });

      await tx.registroAuditoria.createMany({
        data: [
          {
            accion: 'ACTUALIZAR',
            entidad: 'Usuario',
            entidadId: invitacion.usuarioId,
            actorId: invitacion.usuarioId,
            empresaId: invitacion.usuario.empresaId,
            camposModificados: ['nombre', 'apellido', 'passwordHash', 'estado'],
            ip: ip ?? null,
          },
          {
            accion: 'CREAR',
            entidad: 'AceptacionAviso',
            entidadId: invitacion.usuarioId,
            actorId: invitacion.usuarioId,
            empresaId: invitacion.usuario.empresaId,
            camposModificados: ['versionAviso'],
            ip: ip ?? null,
          },
        ],
      });
    });

    return this.auth.emitirSesion(invitacion.usuarioId);
  }

  private async buscarVigente(token: string) {
    const invitacion = await this.prisma.tokenAcceso.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: { include: { empresa: true } } },
    });

    // Mismo mensaje para token inexistente, usado, revocado o vencido: no se confirma cuál era.
    if (
      !invitacion ||
      invitacion.tipo !== 'INVITACION' ||
      invitacion.usadoAt ||
      invitacion.revocadoAt ||
      invitacion.expiraAt.getTime() <= Date.now()
    ) {
      throw new GoneException('Esta invitación ya no es válida. Pide que te la reenvíen.');
    }

    if (invitacion.usuario.estado !== 'INVITADO') {
      throw new ConflictException('Esta cuenta ya está activada. Inicia sesión normalmente.');
    }

    return invitacion;
  }
}
