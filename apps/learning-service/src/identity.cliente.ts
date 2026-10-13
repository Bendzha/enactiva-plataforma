import { Injectable } from '@nestjs/common';
import { PREFIJO_INTERNO, type TemaInterno } from '@enactiva/shared';
import {
  ClienteInterno,
  CLS_REQUEST_ID,
  CLS_TOKEN_ACCESO,
  type ContextoPeticion,
} from '@enactiva/service-kit';
import { ClsService } from 'nestjs-cls';
import { env } from './config/env.js';

/**
 * Lo que este servicio le pregunta a identity-service (ADR-0007).
 *
 * Va con el token de la persona que originó la petición, no con un token de servicio: así
 * identity verifica la firma y acota la respuesta a **su** empresa. Por eso un temaId de otra
 * organización simplemente no vuelve, sin que este servicio tenga que saber de empresas.
 */
@Injectable()
export class IdentityCliente {
  private readonly cliente: ClienteInterno;

  constructor(private readonly cls: ClsService) {
    this.cliente = new ClienteInterno('identity-service', env().URL_IDENTITY_SERVICE, () =>
      this.contexto(),
    );
  }

  async temasPorIds(ids: readonly string[]): Promise<Map<string, string>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map();

    const temas = await this.cliente.get<TemaInterno[]>(
      `/${PREFIJO_INTERNO}/temas?ids=${unicos.map(encodeURIComponent).join(',')}`,
    );
    return new Map(temas.map((tema) => [tema.id, tema.nombre]));
  }

  private contexto(): ContextoPeticion {
    return {
      tokenAcceso: this.cls.get<string | undefined>(CLS_TOKEN_ACCESO) ?? null,
      requestId: this.cls.get<string | undefined>(CLS_REQUEST_ID) ?? null,
    };
  }
}
