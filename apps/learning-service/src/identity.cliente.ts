import { Injectable } from '@nestjs/common';
import {
  CABECERA_INTERNO,
  PREFIJO_INTERNO,
  type ContextoAfinidad,
  type DestinatarioInterno,
  type PersonaInterna,
  type TemaInterno,
} from '@enactiva/shared';
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

  /**
   * Cómo se llaman unas personas, para firmar las referencias que escribieron (SPEC §3.5).
   *
   * Reusa la misma ruta que arma el mazo en vez de abrir otra: devuelve exactamente lo que se
   * muestra en pantalla —nombre, cargo y área— y ya está acotada por empresa con el token de
   * quien pide. Una ruta nueva sería una segunda puerta a los mismos datos.
   */
  async personasPorIds(ids: readonly string[]): Promise<Map<string, PersonaInterna>> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return new Map();

    const contexto = await this.cliente.get<ContextoAfinidad>(
      `/${PREFIJO_INTERNO}/perfiles/contexto?personas=${unicos.map(encodeURIComponent).join(',')}`,
    );
    return new Map(contexto.personas.map((persona) => [persona.id, persona]));
  }

  /**
   * A dónde mandarle el correo a un grupo de personas.
   *
   * Esta va con el **secreto compartido** y no con el token de nadie: quien la llama es el reloj
   * de los recordatorios, que corre sin que haya una sesión abierta (ADR-0007).
   */
  async destinatarios(ids: readonly string[]): Promise<DestinatarioInterno[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return [];

    const url = new URL(`/${PREFIJO_INTERNO}/destinatarios`, env().URL_IDENTITY_SERVICE);
    url.searchParams.set('ids', unicos.join(','));

    const res = await fetch(url, { headers: { [CABECERA_INTERNO]: env().INTERNO_SECRETO } });
    if (!res.ok) {
      throw new Error(`identity-service respondió ${res.status} al pedir destinatarios`);
    }
    return (await res.json()) as DestinatarioInterno[];
  }

  private contexto(): ContextoPeticion {
    return {
      tokenAcceso: this.cls.get<string | undefined>(CLS_TOKEN_ACCESO) ?? null,
      requestId: this.cls.get<string | undefined>(CLS_REQUEST_ID) ?? null,
    };
  }
}
