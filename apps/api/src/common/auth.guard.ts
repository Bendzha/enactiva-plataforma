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
import { tienePermisos, type NivelAdmin, type Permiso, type Rol } from '@enactiva/shared';
import { ClsService } from 'nestjs-cls';
import { CLAVE_PERMISOS, CLAVE_PUBLICO, CLAVE_SOLO_SESION } from './decoradores.js';
import { CLS_SESION, type RequestConSesion, type SesionActual } from './sesion.js';

interface PayloadAccessToken {
  sub: string;
  roles?: Rol[];
  nivelAdmin?: NivelAdmin | null;
  empresaId?: string | null;
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
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, destinos)) {
      return true;
    }

    const req = contexto.switchToHttp().getRequest<RequestConSesion>();
    const payload = await this.verificarToken(req);

    const sesion: SesionActual = {
      usuarioId: payload.sub,
      roles: payload.roles ?? [],
      nivelAdmin: payload.nivelAdmin ?? null,
      empresaId: payload.empresaId ?? null,
      ip: req.ip ?? null,
    };
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
