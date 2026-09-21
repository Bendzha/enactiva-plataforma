import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { LoginInput, NivelAdmin, RespuestaLogin, Rol, UsuarioSesion } from '@enactiva/shared';
import { verificarPassword } from '../../common/password.js';
import { generarToken, hashToken } from '../../common/tokens.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ACCESS_TOKEN_TTL, HASH_FICTICIO, REFRESH_TTL_DIAS } from './auth.constantes.js';

interface UsuarioConRoles {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  nivelAdmin: NivelAdmin | null;
  empresaId: string | null;
  roles: { rol: Rol }[];
}

export interface SesionEmitida {
  respuesta: RespuestaLogin;
  refreshToken: string;
  refreshExpiraAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(datos: LoginInput, ip?: string | null): Promise<SesionEmitida> {
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

    return this.emitirSesion(usuario.id);
  }

  async refrescar(refreshToken: string | undefined, ip?: string | null): Promise<SesionEmitida> {
    if (!refreshToken) {
      throw new UnauthorizedException('Sesión no válida');
    }

    const fila = await this.prisma.tokenAcceso.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
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

    return this.emitirSesion(fila.usuarioId);
  }

  async cerrarSesion(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    await this.prisma.tokenAcceso.updateMany({
      where: { tokenHash: hashToken(refreshToken), revocadoAt: null },
      data: { revocadoAt: new Date() },
    });
  }

  /** Perfil de la persona autenticada, leído de la base y no del token. */
  async perfil(usuarioId: string): Promise<UsuarioSesion> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { roles: true },
    });

    return this.mapearSesion(usuario);
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

  private async emitirSesion(usuarioId: string): Promise<SesionEmitida> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      include: { roles: true },
    });

    const sesion = this.mapearSesion(usuario);

    const accessToken = await this.jwt.signAsync(
      {
        sub: sesion.id,
        roles: sesion.roles,
        nivelAdmin: sesion.nivelAdmin,
        empresaId: sesion.empresaId,
      },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = generarToken();
    const refreshExpiraAt = new Date(Date.now() + REFRESH_TTL_DIAS * 24 * 60 * 60 * 1000);
    await this.prisma.tokenAcceso.create({
      data: {
        usuarioId: sesion.id,
        tipo: 'REFRESH',
        tokenHash: hashToken(refreshToken),
        expiraAt: refreshExpiraAt,
      },
    });

    return { respuesta: { accessToken, usuario: sesion }, refreshToken, refreshExpiraAt };
  }
}
