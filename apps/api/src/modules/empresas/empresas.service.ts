import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CrearEmpresaInput, EmpresaDetalle, EmpresaResumen } from '@enactiva/shared';
import type { SesionActual } from '../../common/sesion.js';
import { generarToken, hashToken } from '../../common/tokens.js';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { CorreoService } from '../correo/correo.service.js';
import { INVITACION_TTL_DIAS } from './empresas.constantes.js';

interface ContactoConInvitacion {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  estado: 'INVITADO' | 'ACTIVO' | 'SUSPENDIDO' | 'ANONIMIZADO';
  tokens: { expiraAt: Date }[];
}

// Solo el equipo ENACTIVA llega a este módulo (permisos empresas:*), así que se usa el cliente
// sin acotar: necesita ver y crear empresas de todo el piloto.
@Injectable()
export class EmpresasService {
  private readonly logger = new Logger(EmpresasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Empresas del piloto con el número de personas activas en cada una. */
  async listar(): Promise<EmpresaResumen[]> {
    const empresas = await this.prisma.acotado.empresa.findMany({
      orderBy: { nombre: 'asc' },
      include: {
        _count: { select: { usuarios: { where: { estado: 'ACTIVO' } } } },
      },
    });

    return empresas.map((empresa) => ({
      id: empresa.id,
      nombre: empresa.nombre,
      rubro: empresa.rubro,
      estado: empresa.estado,
      activadaAt: empresa.activadaAt?.toISOString() ?? null,
      personasActivas: empresa._count.usuarios,
    }));
  }

  /** Ficha de la empresa, con el estado de la invitación de su contacto de RRHH. */
  async detalle(id: string): Promise<EmpresaDetalle> {
    const empresa = await this.prisma.acotado.empresa.findUnique({
      where: { id },
      include: {
        _count: { select: { usuarios: { where: { estado: 'ACTIVO' } } } },
        usuarios: {
          where: { roles: { some: { rol: 'RRHH' } } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          include: {
            tokens: {
              where: { tipo: 'INVITACION', usadoAt: null, revocadoAt: null },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const contacto = empresa.usuarios[0];

    return {
      id: empresa.id,
      nombre: empresa.nombre,
      rubro: empresa.rubro,
      estado: empresa.estado,
      activadaAt: empresa.activadaAt?.toISOString() ?? null,
      personasActivas: empresa._count.usuarios,
      createdAt: empresa.createdAt.toISOString(),
      contactoRrhh: contacto ? this.aContacto(contacto) : null,
    };
  }

  /**
   * Crea la empresa en onboarding junto con la cuenta de RRHH invitada, y le envía el correo
   * de activación. El correo se manda DESPUÉS de confirmar la transacción: si falla el envío,
   * la invitación existe igual y se puede reenviar (ADR-0004).
   */
  async crear(datos: CrearEmpresaInput, sesion: SesionActual): Promise<EmpresaDetalle> {
    const yaExiste = await this.prisma.usuario.findUnique({ where: { email: datos.emailRrhh } });
    if (yaExiste) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const token = generarToken();
    const invitacionExpiraAt = new Date(Date.now() + INVITACION_TTL_DIAS * 24 * 60 * 60 * 1000);

    const { empresa, contacto } = await this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nombre: datos.nombre, rubro: datos.rubro, creadaPorId: sesion.usuarioId },
      });

      const contacto = await tx.usuario.create({
        data: {
          email: datos.emailRrhh,
          empresaId: empresa.id,
          estado: 'INVITADO',
          roles: { create: { rol: 'RRHH' } },
          tokens: {
            create: {
              tipo: 'INVITACION',
              tokenHash: hashToken(token),
              expiraAt: invitacionExpiraAt,
            },
          },
        },
      });

      await tx.registroAuditoria.createMany({
        data: [
          {
            accion: 'CREAR',
            entidad: 'Empresa',
            entidadId: empresa.id,
            actorId: sesion.usuarioId,
            actorRol: 'ADMIN_ENACTIVA',
            empresaId: empresa.id,
            camposModificados: ['nombre', 'rubro', 'estado'],
            ip: sesion.ip,
          },
          {
            accion: 'CREAR',
            entidad: 'Usuario',
            entidadId: contacto.id,
            actorId: sesion.usuarioId,
            actorRol: 'ADMIN_ENACTIVA',
            empresaId: empresa.id,
            camposModificados: ['email', 'estado', 'roles', 'invitacion'],
            ip: sesion.ip,
          },
        ],
      });

      return { empresa, contacto };
    });

    await this.enviarInvitacion(contacto.email!, empresa.nombre, token);

    return {
      id: empresa.id,
      nombre: empresa.nombre,
      rubro: empresa.rubro,
      estado: empresa.estado,
      activadaAt: null,
      personasActivas: 0,
      createdAt: empresa.createdAt.toISOString(),
      contactoRrhh: {
        id: contacto.id,
        email: contacto.email!,
        nombre: contacto.nombre,
        apellido: contacto.apellido,
        estado: contacto.estado,
        invitacionExpiraAt: invitacionExpiraAt.toISOString(),
      },
    };
  }

  /** Activación manual por el Admin Principal: es la decisión de que la empresa entra al piloto. */
  async activar(id: string, sesion: SesionActual): Promise<EmpresaDetalle> {
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }
    if (empresa.estado === 'ACTIVA') {
      throw new ConflictException('La empresa ya está activa');
    }

    await this.prisma.empresa.update({
      where: { id },
      data: { estado: 'ACTIVA', activadaAt: new Date(), activadaPorId: sesion.usuarioId },
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'Empresa',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: 'ADMIN_ENACTIVA',
      empresaId: id,
      camposModificados: ['estado', 'activadaAt', 'activadaPorId'],
      ip: sesion.ip,
    });

    return this.detalle(id);
  }

  /** Emite una invitación nueva y revoca la anterior (por ejemplo, si venció o se perdió). */
  async reenviarInvitacion(empresaId: string, sesion: SesionActual): Promise<EmpresaDetalle> {
    const empresa = await this.prisma.empresa.findUnique({ where: { id: empresaId } });
    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const contacto = await this.prisma.usuario.findFirst({
      where: { empresaId, roles: { some: { rol: 'RRHH' } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!contacto?.email) {
      throw new NotFoundException('La empresa no tiene un contacto de RRHH');
    }
    if (contacto.estado !== 'INVITADO') {
      throw new ConflictException('El contacto ya activó su cuenta');
    }

    const token = generarToken();
    const expiraAt = new Date(Date.now() + INVITACION_TTL_DIAS * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.tokenAcceso.updateMany({
        where: { usuarioId: contacto.id, tipo: 'INVITACION', revocadoAt: null },
        data: { revocadoAt: new Date() },
      });
      await tx.tokenAcceso.create({
        data: {
          usuarioId: contacto.id,
          tipo: 'INVITACION',
          tokenHash: hashToken(token),
          expiraAt,
        },
      });
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'TokenAcceso',
      entidadId: contacto.id,
      actorId: sesion.usuarioId,
      actorRol: 'ADMIN_ENACTIVA',
      empresaId,
      camposModificados: ['tokenHash', 'expiraAt', 'revocadoAt'],
      ip: sesion.ip,
    });

    await this.enviarInvitacion(contacto.email, empresa.nombre, token);

    return this.detalle(empresaId);
  }

  private aContacto(contacto: ContactoConInvitacion) {
    return {
      id: contacto.id,
      email: contacto.email ?? '',
      nombre: contacto.nombre,
      apellido: contacto.apellido,
      estado: contacto.estado,
      invitacionExpiraAt: contacto.tokens[0]?.expiraAt.toISOString() ?? null,
    };
  }

  private async enviarInvitacion(para: string, nombreEmpresa: string, token: string) {
    try {
      await this.correo.enviarInvitacionRrhh({
        para,
        nombreEmpresa,
        urlActivacion: `${env().WEB_ORIGIN}/activar?token=${token}`,
        diasParaExpirar: INVITACION_TTL_DIAS,
      });
    } catch (error) {
      // La invitación ya está creada: el Admin puede reenviarla desde la ficha de la empresa.
      this.logger.error(`No se pudo enviar la invitación a ${para}`, error);
    }
  }
}
