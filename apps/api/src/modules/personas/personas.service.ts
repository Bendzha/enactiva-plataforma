import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { InvitarPersonaInput, PersonaResumen } from '@enactiva/shared';
import type { SesionActual } from '../../common/sesion.js';
import { generarToken, hashToken } from '../../common/tokens.js';
import { env } from '../../config/env.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { CorreoService } from '../correo/correo.service.js';
import { INVITACION_TTL_DIAS } from '../empresas/empresas.constantes.js';

interface PersonaConDatos {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  cargo: string | null;
  areaId: string | null;
  estado: 'INVITADO' | 'ACTIVO' | 'SUSPENDIDO' | 'ANONIMIZADO';
  area: { nombre: string } | null;
  roles: { rol: 'ADMIN_ENACTIVA' | 'RRHH' | 'CAPACITADOR' | 'ESTUDIANTE' }[];
  tokens: { expiraAt: Date }[];
}

/** Gente de una empresa: siempre se consulta con el cliente acotado, nunca se cruza entre empresas. */
@Injectable()
export class PersonasService {
  private readonly logger = new Logger(PersonasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(): Promise<PersonaResumen[]> {
    const personas = await this.prisma.acotado.usuario.findMany({
      orderBy: [{ estado: 'asc' }, { createdAt: 'asc' }],
      include: {
        area: { select: { nombre: true } },
        roles: { select: { rol: true } },
        tokens: {
          where: { tipo: 'INVITACION', usadoAt: null, revocadoAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return personas.map((persona) => this.aResumen(persona));
  }

  async invitar(datos: InvitarPersonaInput, sesion: SesionActual): Promise<PersonaResumen> {
    const empresaId = this.empresaDe(sesion);

    const yaExiste = await this.prisma.usuario.findUnique({ where: { email: datos.email } });
    if (yaExiste) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    if (datos.areaId) {
      // El cliente acotado garantiza que el área sea de la misma empresa.
      const area = await this.prisma.acotado.area.findUnique({ where: { id: datos.areaId } });
      if (!area) {
        throw new BadRequestException('El área indicada no existe en tu empresa');
      }
    }

    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    const token = generarToken();
    const invitacionExpiraAt = new Date(Date.now() + INVITACION_TTL_DIAS * 24 * 60 * 60 * 1000);

    const persona = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.usuario.create({
        data: {
          email: datos.email,
          empresaId,
          areaId: datos.areaId ?? null,
          cargo: datos.cargo ?? null,
          estado: 'INVITADO',
          roles: { create: datos.roles.map((rol) => ({ rol })) },
          tokens: {
            create: {
              tipo: 'INVITACION',
              tokenHash: hashToken(token),
              expiraAt: invitacionExpiraAt,
            },
          },
        },
        include: {
          area: { select: { nombre: true } },
          roles: { select: { rol: true } },
          tokens: true,
        },
      });

      await tx.registroAuditoria.create({
        data: {
          accion: 'CREAR',
          entidad: 'Usuario',
          entidadId: creada.id,
          actorId: sesion.usuarioId,
          actorRol: 'RRHH',
          empresaId,
          camposModificados: ['email', 'estado', 'roles', 'areaId', 'cargo', 'invitacion'],
          ip: sesion.ip,
        },
      });

      return creada;
    });

    await this.enviarInvitacion(datos.email, empresa.nombre, token);

    return this.aResumen({ ...persona, tokens: [{ expiraAt: invitacionExpiraAt }] });
  }

  async reenviarInvitacion(id: string, sesion: SesionActual): Promise<PersonaResumen> {
    const empresaId = this.empresaDe(sesion);

    const persona = await this.prisma.acotado.usuario.findUnique({
      where: { id },
      include: { area: { select: { nombre: true } }, roles: { select: { rol: true } } },
    });
    if (!persona?.email) {
      throw new NotFoundException('Persona no encontrada');
    }
    if (persona.estado !== 'INVITADO') {
      throw new ConflictException('Esta persona ya activó su cuenta');
    }

    const empresa = await this.prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    const token = generarToken();
    const expiraAt = new Date(Date.now() + INVITACION_TTL_DIAS * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.tokenAcceso.updateMany({
        where: { usuarioId: id, tipo: 'INVITACION', revocadoAt: null },
        data: { revocadoAt: new Date() },
      });
      await tx.tokenAcceso.create({
        data: { usuarioId: id, tipo: 'INVITACION', tokenHash: hashToken(token), expiraAt },
      });
    });

    await this.auditoria.registrar({
      accion: 'ACTUALIZAR',
      entidad: 'TokenAcceso',
      entidadId: id,
      actorId: sesion.usuarioId,
      actorRol: 'RRHH',
      empresaId,
      camposModificados: ['tokenHash', 'expiraAt', 'revocadoAt'],
      ip: sesion.ip,
    });

    await this.enviarInvitacion(persona.email, empresa.nombre, token);

    return this.aResumen({ ...persona, tokens: [{ expiraAt }] });
  }

  private async enviarInvitacion(para: string, nombreEmpresa: string, token: string) {
    try {
      await this.correo.enviarInvitacionColaborador({
        para,
        nombreEmpresa,
        urlActivacion: `${env().WEB_ORIGIN}/activar?token=${token}`,
        diasParaExpirar: INVITACION_TTL_DIAS,
      });
    } catch (error) {
      // La invitación ya existe: RRHH puede reenviarla desde la pantalla de Personas.
      this.logger.error(`No se pudo enviar la invitación a ${para}`, error);
    }
  }

  private aResumen(persona: PersonaConDatos): PersonaResumen {
    return {
      id: persona.id,
      email: persona.email ?? '',
      nombre: persona.nombre,
      apellido: persona.apellido,
      cargo: persona.cargo,
      areaId: persona.areaId,
      areaNombre: persona.area?.nombre ?? null,
      roles: persona.roles.map((fila) => fila.rol),
      estado: persona.estado,
      invitacionExpiraAt:
        persona.estado === 'INVITADO' ? (persona.tokens[0]?.expiraAt.toISOString() ?? null) : null,
    };
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
