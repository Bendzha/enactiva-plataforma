import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { tienePermisos, type Permiso } from '@enactiva/shared';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service.js';
import { CLAVE_PERMISOS, CLAVE_PUBLICO, CLAVE_SOLO_SESION } from './decoradores.js';
import { CLS_SESION, type RequestConSesion, type SesionActual } from './sesion.js';

interface PayloadAccessToken {
  sub: string;
}

/**
 * Guard global: cierra la API por defecto (ADR-0003).
 * Una ruta debe declarar @Publico, @SoloSesion o @RequierePermiso; si no declara nada, se rechaza.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly cls: ClsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, destinos)) {
      return true;
    }

    const req = contexto.switchToHttp().getRequest<RequestConSesion>();
    const payload = await this.verificarToken(req);
    const sesion = await this.cargarSesion(payload.sub, req.ip ?? null);

    req.sesion = sesion;
    this.cls.set(CLS_SESION, sesion);

    const requeridos = this.reflector.getAllAndOverride<Permiso[]>(CLAVE_PERMISOS, destinos);
    if (requeridos?.length) {
      if (!tienePermisos(sesion.roles, sesion.nivelAdmin, requeridos)) {
        throw new ForbiddenException('No tienes permiso para realizar esta acción');
      }
      return true;
    }

    if (this.reflector.getAllAndOverride<boolean>(CLAVE_SOLO_SESION, destinos)) {
      return true;
    }

    // Error de programación, no del usuario: la ruta existe pero nadie declaró quién puede usarla.
    this.logger.error(
      `${req.method} ${req.url} no declara @Publico, @SoloSesion ni @RequierePermiso`,
    );
    throw new ForbiddenException('Esta ruta no declara permisos');
  }

  /**
   * Los roles, el nivel y el estado se leen de la base en cada petición, no del token:
   * si a alguien se le quita el acceso, deja de entrar de inmediato y no en 15 minutos.
   */
  private async cargarSesion(usuarioId: string, ip: string | null): Promise<SesionActual> {
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

    if (!usuario || usuario.estado !== 'ACTIVO') {
      throw new UnauthorizedException('Tu cuenta no está activa');
    }

    return {
      usuarioId: usuario.id,
      roles: usuario.roles.map((fila) => fila.rol),
      nivelAdmin: usuario.nivelAdmin,
      empresaId: usuario.empresaId,
      ip,
    };
  }

  private async verificarToken(req: RequestConSesion): Promise<PayloadAccessToken> {
    const cabecera = req.headers.authorization ?? '';
    const [esquema, token] = cabecera.split(' ');

    if (esquema !== 'Bearer' || !token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    try {
      return await this.jwt.verifyAsync<PayloadAccessToken>(token);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
