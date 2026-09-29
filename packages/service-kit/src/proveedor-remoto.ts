import { Injectable, type Provider } from '@nestjs/common';
import { PREFIJO_INTERNO, type EstadoSesionInterno } from '@enactiva/shared';
import { ClsService } from 'nestjs-cls';
import { cabecerasInternas } from './contexto-interno.js';
import {
  PROVEEDOR_ESTADO_SESION,
  type EstadoSesion,
  type ProveedorEstadoSesion,
} from './estado-sesion.js';
import { CLS_REQUEST_ID, CLS_TOKEN_ACCESO } from './sesion.js';

/**
 * Resuelve el estado de sesión preguntándole a identity-service (ADR-0007).
 *
 * Lo usan los servicios que no tienen las tablas de usuarios. Reenvía el token de la persona tal
 * como llegó: identity verifica la firma y responde por el dueño de ese token, así que **no hay
 * forma de preguntar por otra persona** ni de colar un empresaId por parámetro.
 *
 * Cada respuesta la cachea `CacheEstadoSesion` durante 30 s, de modo que esto no es una llamada
 * por petición.
 */
@Injectable()
export class ProveedorEstadoSesionRemoto implements ProveedorEstadoSesion {
  constructor(
    private readonly cls: ClsService,
    private readonly urlIdentity: string,
  ) {}

  async cargar(usuarioId: string): Promise<EstadoSesion | null> {
    const tokenAcceso = this.cls.get<string | undefined>(CLS_TOKEN_ACCESO) ?? null;
    if (!tokenAcceso) {
      return null;
    }

    const res = await fetch(`${this.urlIdentity}/${PREFIJO_INTERNO}/sesiones/actual`, {
      method: 'GET',
      headers: cabecerasInternas({
        tokenAcceso,
        requestId: this.cls.get<string | undefined>(CLS_REQUEST_ID) ?? null,
      }),
    });

    // 401 es la respuesta normal para una cuenta desactivada o un token que ya no vale.
    if (res.status === 401 || res.status === 404) {
      return null;
    }
    if (!res.ok) {
      throw new Error(`identity-service respondió ${res.status} al resolver la sesión`);
    }

    const estado = (await res.json()) as EstadoSesionInterno;
    return estado.usuarioId === usuarioId ? estado : null;
  }
}

/** Azúcar para el `AppModule` de cada servicio que no es identity. */
export function proveedorEstadoSesionRemoto(urlIdentity: string): Provider {
  return {
    provide: PROVEEDOR_ESTADO_SESION,
    inject: [ClsService],
    useFactory: (cls: ClsService) => new ProveedorEstadoSesionRemoto(cls, urlIdentity),
  };
}
