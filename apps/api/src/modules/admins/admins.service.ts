import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { AdminResumen, CrearAdminInput } from '@enactiva/shared';
import type { SesionActual } from '../../common/sesion.js';
import { generarToken, hashToken } from '../../common/tokens.js';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { CorreoService } from '../correo/correo.service.js';
import { INVITACION_TTL_DIAS } from '../empresas/empresas.constantes.js';

interface AdminConDatos {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  nivelAdmin: 'PRINCIPAL' | 'OPERATIVO' | null;
  estado: 'INVITADO' | 'ACTIVO' | 'SUSPENDIDO' | 'ANONIMIZADO';
  tokens: { expiraAt: Date }[];
}

// Solo el Admin Principal llega aquí (permiso admins:gestionar).
@Injectable()
export class AdminsService {
  private readonly logger = new Logger(AdminsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<AdminResumen[]> {
    const admins = await this.prisma.usuario.findMany({
      where: { roles: { some: { rol: 'ADMIN_ENACTIVA' } } },
      orderBy: [{ nivelAdmin: 'asc' }, { createdAt: 'asc' }],
      include: {
        tokens: {
          where: { tipo: 'INVITACION', usadoAt: null, revocadoAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return admins.map((admin) => this.aResumen(admin));
  }

  async invitar(datos: CrearAdminInput, sesion: SesionActual): Promise<AdminResumen> {
    const yaExiste = await this.prisma.usuario.findUnique({ where: { email: datos.email } });
    if (yaExiste) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const token = generarToken();
    const expiraAt = new Date(Date.now() + INVITACION_TTL_DIAS * 24 * 60 * 60 * 1000);

    const admin = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({
        data: {
          email: datos.email,
          estado: 'INVITADO',
          nivelAdmin: datos.nivelAdmin,
          roles: { create: { rol: 'ADMIN_ENACTIVA' } },
          tokens: { create: { tipo: 'INVITACION', tokenHash: hashToken(token), expiraAt } },
        },
        include: { tokens: true },
      });

      await tx.registroAuditoria.create({
        data: {
          accion: 'CREAR',
          entidad: 'Usuario',
          entidadId: creado.id,
          actorId: sesion.usuarioId,
          actorRol: 'ADMIN_ENACTIVA',
          camposModificados: ['email', 'estado', 'nivelAdmin', 'roles', 'invitacion'],
          ip: sesion.ip,
        },
      });

      return creado;
    });

    try {
      await this.correo.enviarInvitacionAdmin({
        para: datos.email,
        urlActivacion: `${env().WEB_ORIGIN}/activar?token=${token}`,
        diasParaExpirar: INVITACION_TTL_DIAS,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar la invitación a ${datos.email}`, error);
    }

    return this.aResumen({ ...admin, tokens: [{ expiraAt }] });
  }

  /** Deja al admin sin acceso y corta sus sesiones abiertas. No se borra: la auditoría lo referencia. */
  async desactivar(id: string, sesion: SesionActual): Promise<AdminResumen> {
    if (id === sesion.usuarioId) {
      throw new ConflictException('No puedes desactivar tu propia cuenta');
    }

    const admin = await this.prisma.usuario.findFirst({
      where: { id, roles: { some: { rol: 'ADMIN_ENACTIVA' } } },
    });
    if (!admin) {
      throw new NotFoundException('Administrador no encontrado');
    }
    if (admin.estado === 'SUSPENDIDO') {
      throw new ConflictException('Esta cuenta ya está desactivada');
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.usuario.update({
        where: { id },
        data: { estado: 'SUSPENDIDO' },
        include: { tokens: true },
      });
      await tx.tokenAcceso.updateMany({
        where: { usuarioId: id, revocadoAt: null },
        data: { revocadoAt: new Date() },
      });
      return actualizado;
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Usuario',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: 'ADMIN_ENACTIVA',
      camposModificados: ['estado', 'tokens'],
      ip: sesion.ip,
    });

    return this.aResumen({ ...actualizado, tokens: [] });
  }

  private aResumen(admin: AdminConDatos): AdminResumen {
    return {
      id: admin.id,
      email: admin.email ?? '',
      nombre: admin.nombre,
      apellido: admin.apellido,
      nivelAdmin: admin.nivelAdmin ?? 'OPERATIVO',
      estado: admin.estado,
      invitacionExpiraAt:
        admin.estado === 'INVITADO' ? (admin.tokens[0]?.expiraAt.toISOString() ?? null) : null,
    };
  }
}
