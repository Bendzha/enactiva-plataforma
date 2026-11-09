import { Injectable } from '@nestjs/common';
import {
  PREFIJO_INTERNO,
  type ContextoAfinidad,
  type TallerAbierto,
  type TallerInterno,
  type ValoracionDeFacilitador,
} from '@enactiva/shared';
import {
  ClienteInterno,
  CLS_REQUEST_ID,
  CLS_TOKEN_ACCESO,
  ErrorServicioInterno,
  type ContextoPeticion,
} from '@enactiva/service-kit';
import { ClsService } from 'nestjs-cls';
import { env } from './config/env.js';

/**
 * Lo que matching-service le pregunta a los otros dos (ADR-0007).
 *
 * El mazo del swipe **no es una consulta SQL**: los talleres viven en learning_db y los perfiles
 * en identity_db, y ninguna base ve a la otra. Este servicio pide las dos piezas y las junta.
 *
 * Las dos llamadas van con el token de quien mira el mazo, no con un token de servicio: así cada
 * servicio verifica la firma y acota su respuesta a la empresa de esa persona. matching nunca
 * manda un empresaId, porque un endpoint que confiara en eso sería un hoyo entre empresas.
 */
@Injectable()
export class ClientesInternos {
  private readonly learning: ClienteInterno;
  private readonly identity: ClienteInterno;

  constructor(private readonly cls: ClsService) {
    const contexto = () => this.contexto();
    this.learning = new ClienteInterno('learning-service', env().URL_LEARNING_SERVICE, contexto);
    this.identity = new ClienteInterno('identity-service', env().URL_IDENTITY_SERVICE, contexto);
  }

  /** Talleres a los que esta persona podría entrar: futuros, con cupo, ni suyos ni ya tomados. */
  talleresAbiertos(): Promise<TallerAbierto[]> {
    return this.learning.get<TallerAbierto[]>(`/${PREFIJO_INTERNO}/talleres/abiertos`);
  }

  /** Personas, declaraciones y nombres de tema, en una sola llamada. */
  contextoAfinidad(
    personas: readonly string[],
    temas: readonly string[],
  ): Promise<ContextoAfinidad> {
    const parametros = new URLSearchParams({
      personas: [...new Set(personas)].join(','),
      temas: [...new Set(temas)].join(','),
    });
    return this.identity.get<ContextoAfinidad>(
      `/${PREFIJO_INTERNO}/perfiles/contexto?${parametros.toString()}`,
    );
  }

  /**
   * Un taller puntual: lo necesita la puntuación del match para no aceptar una respuesta sobre
   * un encuentro que todavía no ocurrió. Devuelve null si no existe en la empresa de quien pide.
   */
  async tallerPorId(id: string): Promise<TallerInterno | null> {
    try {
      return await this.learning.get<TallerInterno>(`/${PREFIJO_INTERNO}/talleres/${id}`);
    } catch (error) {
      if (error instanceof ErrorServicioInterno && error.status === 404) return null;
      throw error;
    }
  }

  /**
   * El promedio de estrellas de cada facilitador, para el cuarto criterio del score (ADR-0009).
   *
   * learning devuelve `null` para quien todavía no junta suficientes valoraciones, y el score
   * reparte ese peso entre los demás criterios. Ese umbral lo decide learning, que es quien
   * tiene las valoraciones; aquí no se vuelve a juzgar.
   */
  async valoracionesDeFacilitadores(
    capacitadorIds: readonly string[],
  ): Promise<Map<string, number | null>> {
    const unicos = [...new Set(capacitadorIds)];
    if (unicos.length === 0) return new Map();

    const valoraciones = await this.learning.get<ValoracionDeFacilitador[]>(
      `/${PREFIJO_INTERNO}/valoraciones/facilitadores?ids=${unicos.map(encodeURIComponent).join(',')}`,
    );
    return new Map(valoraciones.map((fila) => [fila.capacitadorId, fila.promedio]));
  }

  /**
   * Inscribe a quien mira el mazo en ese taller, llamando a learning con su propio token.
   * No es una ruta /interno: es exactamente el mismo endpoint que usa la pantalla de Talleres,
   * con sus mismas reglas de cupo y de fecha.
   */
  inscribir(tallerId: string): Promise<unknown> {
    return this.learning.post(`/talleres/${tallerId}/inscripcion`);
  }

  private contexto(): ContextoPeticion {
    return {
      tokenAcceso: this.cls.get<string | undefined>(CLS_TOKEN_ACCESO) ?? null,
      requestId: this.cls.get<string | undefined>(CLS_REQUEST_ID) ?? null,
    };
  }
}
