import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { CABECERA_INTERNO, tienePermisos, type Permiso } from '@enactiva/shared';
import { ClsService } from 'nestjs-cls';
import { CLAVE_INTERNO, CLAVE_PERMISOS, CLAVE_PUBLICO, CLAVE_SOLO_SESION } from './decoradores.js';
import { CacheEstadoSesion } from './estado-sesion.js';
import { SECRETO_INTERNO, verificarSecretoInterno } from './secreto-interno.js';
import {
  CLS_SESION,
  CLS_TOKEN_ACCESO,
  type RequestConSesion,
  type SesionActual,
} from './sesion.js';

interface PayloadAccessToken {
  sub: string;
}

/**
 * Guard global de todos los servicios (ADR-0003, ADR-0007).
 *
 * Cierra la API por defecto: una ruta debe declarar @Publico, @SoloSesion o @RequierePermiso.
 * Si no declara nada se rechaza, porque olvidar el decorador no puede terminar en un endpoint
 * abierto.
 *
 * Verifica la firma del token localmente, pero los roles, el nivel y el estado los toma del
 * estado de sesión cacheado y NO del contenido del token: el token puede haberse firmado antes
 * de que a esa persona le cambiaran el rol o la desactivaran.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly cls: ClsService,
    private readonly estadoSesion: CacheEstadoSesion,
    @Inject(SECRETO_INTERNO) @Optional() private readonly secretoInterno?: string,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const destinos = [contexto.getHandler(), contexto.getClass()];

    if (this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, destinos)) {
      return true;
    }

    const req = contexto.switchToHttp().getRequest<RequestConSesion>();

    // Llamada de otro servicio: no hay usuario todavía (es anterior al login), así que se
    // autentica con el secreto compartido y no con un token.
    if (this.reflector.getAllAndOverride<boolean>(CLAVE_INTERNO, destinos)) {
      verificarSecretoInterno(req.headers[CABECERA_INTERNO], this.secretoInterno);
      return true;
    }

    const { payload, token } = await this.verificarToken(req);
    // Se guarda ANTES de resolver la sesión: los servicios que no tienen las tablas de usuarios
    // se la preguntan a identity-service reenviando este mismo token (ADR-0007).
    this.cls.set(CLS_TOKEN_ACCESO, token);

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

  private async cargarSesion(usuarioId: string, ip: string | null): Promise<SesionActual> {
    const estado = await this.estadoSesion.obtener(usuarioId);

    if (!estado?.activo) {
      throw new UnauthorizedException('Tu cuenta no está activa');
    }

    return {
      usuarioId: estado.usuarioId,
      roles: estado.roles,
      nivelAdmin: estado.nivelAdmin,
      empresaId: estado.empresaId,
      ip,
    };
  }

  private async verificarToken(
    req: RequestConSesion,
  ): Promise<{ payload: PayloadAccessToken; token: string }> {
    const cabecera = req.headers.authorization ?? '';
    const [esquema, token] = cabecera.split(' ');

    if (esquema !== 'Bearer' || !token) {
      throw new UnauthorizedException('Falta el token de acceso');
    }

    try {
      return { payload: await this.jwt.verifyAsync<PayloadAccessToken>(token), token };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
