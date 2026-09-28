import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { NivelAdmin, Rol } from '@enactiva/shared';
import type { Request } from 'express';

/** Datos de la sesión que el guard deja disponibles para el resto de la petición. */
export interface SesionActual {
  usuarioId: string;
  roles: Rol[];
  nivelAdmin: NivelAdmin | null;
  /** Null para el equipo ENACTIVA; se usa para acotar las consultas por empresa. */
  empresaId: string | null;
  ip: string | null;
}

/** Claves con las que el contexto por petición viaja en nestjs-cls. */
export const CLS_SESION = 'sesion';
export const CLS_REQUEST_ID = 'requestId';
/**
 * El access token tal como llegó. Se guarda para reenviarlo en las llamadas entre servicios:
 * el servicio que recibe verifica la firma y saca la empresa de los claims, nunca del request
 * (ADR-0007).
 */
export const CLS_TOKEN_ACCESO = 'tokenAcceso';

export interface RequestConSesion extends Request {
  sesion?: SesionActual;
}

/** Inyecta la sesión actual en un controlador: `@Sesion() sesion: SesionActual`. */
export const Sesion = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): SesionActual => {
    const req = ctx.switchToHttp().getRequest<RequestConSesion>();
    if (!req.sesion) {
      throw new Error(
        'No hay sesión en la petición: falta @SoloSesion o @RequierePermiso en la ruta',
      );
    }
    return req.sesion;
  },
);
