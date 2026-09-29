import { Injectable, UnauthorizedException } from '@nestjs/common';
import type {
  EstadoSesionInterno,
  LoginInternoInput,
  NivelAdmin,
  RefrescarInternoInput,
  Rol,
  SesionEstablecida,
  UsuarioSesion,
} from '@enactiva/shared';
import { HASH_FICTICIO, verificarPassword } from '../../common/password.js';
import { generarToken, hashToken } from '../../common/tokens.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { REFRESH_TTL_DIAS } from './sesiones.constantes.js';

interface UsuarioConRoles {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  nivelAdmin: NivelAdmin | null;
  empresaId: string | null;
  roles: { rol: Rol }[];
}

/**
 * Todo lo que toca credenciales y tokens de refresh (ADR-0007, decisión D1).
 *
 * auth-service no tiene base de datos: llama aquí para verificar una contraseña o rotar un
 * refresh, y lo único que hace con la respuesta es firmar el JWT. Así el hash bcrypt y el
 * REFRESH_TOKEN_PEPPER nunca salen de este servicio.
 */
@Injectable()
export class SesionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(datos: LoginInternoInput): Promise<SesionEstablecida> {
    const ip = datos.ip ?? null;
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: datos.email },
      include: { roles: true },
    });

    // Se compara siempre, exista o no el usuario, para no filtrar qué emails están registrados.
    const hash = usuario?.passwordHash ?? HASH_FICTICIO;
    const passwordCorrecta = await verificarPassword(datos.password, hash);
    const puedeIngresar =
      Boolean(usuario?.passwordHash) && usuario?.estado === 'ACTIVO' && passwordCorrecta;

    if (!puedeIngresar) {
      await this.auditoria.registrar({
        accion: 'LOGIN_FALLIDO',
        entidad: 'Usuario',
        entidadId: usuario?.id ?? null,
        actorId: usuario?.id ?? null,
        empresaId: usuario?.empresaId ?? null,
        ip,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.auditoria.registrar({
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidadId: usuario.id,
      actorId: usuario.id,
      actorRol: usuario.roles[0]?.rol ?? null,
      empresaId: usuario.empresaId,
      ip,
    });

    return this.establecer(usuario.id);
  }

  async refrescar(datos: RefrescarInternoInput): Promise<SesionEstablecida> {
    const ip = datos.ip ?? null;
    const fila = await this.prisma.tokenAcceso.findUnique({
      where: { tokenHash: hashToken(datos.token) },
    });

    if (!fila || fila.tipo !== 'REFRESH') {
      throw new UnauthorizedException('Sesión no válida');
    }

    // Reuso de un token ya rotado: se asume robo y se cierran todas las sesiones del usuario.
    if (fila.usadoAt) {
      await this.prisma.tokenAcceso.updateMany({
        where: { usuarioId: fila.usuarioId, tipo: 'REFRESH', revocadoAt: null },
        data: { revocadoAt: new Date() },
      });
      await this.auditoria.registrar({
        accion: 'LOGIN_FALLIDO',
        entidad: 'TokenAcceso',
        entidadId: fila.id,
        actorId: fila.usuarioId,
        camposModificados: ['revocadoAt'],
        ip,
      });
      throw new UnauthorizedException('Sesión no válida');
    }

    if (fila.revocadoAt || fila.expiraAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesión no válida');
    }

    const usuario = await this.prisma.usuario.findUnique({ where: { id: fila.usuarioId } });
    if (usuario?.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Sesión no válida');
    }

    const ahora = new Date();
    await this.prisma.tokenAcceso.update({
      where: { id: fila.id },
      data: { usadoAt: ahora, revocadoAt: ahora },
    });

    return this.establecer(fila.usuarioId);
  }

  async cerrar(token: string): Promise<void> {
    await this.prisma.tokenAcceso.updateMany({
      where: { tokenHash: hashToken(token), revocadoAt: null },
      data: { revocadoAt: new Date() },
    });
  }

  /**
   * Estado que cada servicio consulta y cachea 30 s. Sin nombre ni email a propósito: quien
   * decide permisos no necesita datos personales (ADR-0007).
   */
  async estado(usuarioId: string): Promise<EstadoSesionInterno> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        estado: true,
        empresaId: true,
        nivelAdmin: true,
        roles: { select: { rol: true } },
      },
    });

    return {
      usuarioId,
      roles: usuario?.roles.map((fila) => fila.rol) ?? [],
      nivelAdmin: usuario?.nivelAdmin ?? null,
      empresaId: usuario?.empresaId ?? null,
      activo: usuario?.estado === 'ACTIVO',
    };
  }

  /** Perfil de la persona autenticada, leído de la base y no del token. */
  async perfil(usuarioId: string): Promise<UsuarioSesion> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { roles: true },
    });

    return this.mapearSesion(usuario);
  }

  /**
   * Deja una sesión establecida para una persona ya verificada (login, refresh o activación de
   * invitación): emite el token de refresh y devuelve su valor en claro una sola vez.
   */
  async establecer(usuarioId: string): Promise<SesionEstablecida> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { roles: true },
    });

    const refreshToken = generarToken();
    const refreshExpiraAt = new Date(Date.now() + REFRESH_TTL_DIAS * 24 * 60 * 60 * 1000);

    await this.prisma.tokenAcceso.create({
      data: {
        usuarioId: usuario.id,
        tipo: 'REFRESH',
        tokenHash: hashToken(refreshToken),
        expiraAt: refreshExpiraAt,
      },
    });

    return {
      usuario: this.mapearSesion(usuario),
      refreshToken,
      refreshExpiraAt: refreshExpiraAt.toISOString(),
    };
  }

  private mapearSesion(usuario: UsuarioConRoles): UsuarioSesion {
    return {
      id: usuario.id,
      email: usuario.email ?? '',
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      roles: usuario.roles.map((fila) => fila.rol),
      nivelAdmin: usuario.nivelAdmin,
      empresaId: usuario.empresaId,
    };
  }
}
