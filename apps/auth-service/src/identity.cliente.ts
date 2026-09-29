import { Injectable } from '@nestjs/common';
import { CABECERA_INTERNO, PREFIJO_INTERNO, type SesionEstablecida } from '@enactiva/shared';
import { CABECERA_REQUEST_ID, CLS_REQUEST_ID, CLS_TOKEN_ACCESO } from '@enactiva/service-kit';
import { ClsService } from 'nestjs-cls';
import { env } from './config/env.js';

/**
 * Llamadas de auth-service a identity-service (ADR-0007, decisión D1).
 *
 * Las rutas de sesión son anteriores al login, así que se autentican con el secreto compartido
 * y no con un token de usuario. La respuesta de error se propaga con su código original: un 401
 * de identity por credenciales inválidas tiene que llegar al navegador como 401, no como 500.
 */
@Injectable()
export class IdentityCliente {
  constructor(private readonly cls: ClsService) {}

  login(cuerpo: {
    email: string;
    password: string;
    ip: string | null;
  }): Promise<SesionEstablecida> {
    return this.pedir<SesionEstablecida>('sesiones/login', cuerpo);
  }

  refrescar(cuerpo: { token: string; ip: string | null }): Promise<SesionEstablecida> {
    return this.pedir<SesionEstablecida>('sesiones/refrescar', cuerpo);
  }

  cerrar(token: string): Promise<void> {
    return this.pedir<void>('sesiones/cerrar', { token });
  }

  aceptarInvitacion(cuerpo: Record<string, unknown>): Promise<SesionEstablecida> {
    return this.pedir<SesionEstablecida>('sesiones/invitacion', cuerpo);
  }

  /** Perfil completo de la persona autenticada; va con su propio token, no con el secreto. */
  async perfil<T>(): Promise<T> {
    const res = await fetch(`${env().URL_IDENTITY_SERVICE}/${PREFIJO_INTERNO}/sesiones/perfil`, {
      headers: {
        Authorization: `Bearer ${this.cls.get<string>(CLS_TOKEN_ACCESO)}`,
        ...this.cabeceraRequestId(),
      },
    });
    if (!res.ok) {
      throw await this.aError(res);
    }
    return (await res.json()) as T;
  }

  private async pedir<T>(ruta: string, cuerpo: unknown): Promise<T> {
    const res = await fetch(`${env().URL_IDENTITY_SERVICE}/${PREFIJO_INTERNO}/${ruta}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [CABECERA_INTERNO]: env().INTERNO_SECRETO,
        ...this.cabeceraRequestId(),
      },
      body: JSON.stringify(cuerpo),
    });

    if (!res.ok) {
      throw await this.aError(res);
    }
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private cabeceraRequestId(): Record<string, string> {
    const requestId = this.cls.get<string | undefined>(CLS_REQUEST_ID);
    return requestId ? { [CABECERA_REQUEST_ID]: requestId } : {};
  }

  private async aError(res: Response): Promise<ErrorIdentity> {
    const cuerpo = (await res.json().catch(() => null)) as {
      mensaje?: string;
      message?: string;
    } | null;
    return new ErrorIdentity(res.status, cuerpo?.mensaje ?? cuerpo?.message ?? 'Error inesperado');
  }
}

export class ErrorIdentity extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorIdentity';
  }
}
