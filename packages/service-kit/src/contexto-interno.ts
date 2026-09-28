import { CABECERA_REQUEST_ID } from './constantes.js';

/** Lo que se propaga de una petición cuando un servicio llama a otro. */
export interface ContextoPeticion {
  /** El access token tal como llegó, para que el otro servicio verifique la firma él mismo. */
  tokenAcceso: string | null;
  requestId: string | null;
}

/**
 * Cabeceras de una llamada entre servicios (ADR-0007).
 *
 * Se reenvía el token del usuario, no un token de servicio: así el servicio que recibe verifica
 * la firma y saca la empresa de los claims. **Nunca se manda el empresaId como parámetro**, porque
 * un endpoint interno que confíe en un empresaId del request es un hoyo de aislamiento entre
 * empresas.
 */
export function cabecerasInternas(contexto: ContextoPeticion): Record<string, string> {
  const cabeceras: Record<string, string> = { 'Content-Type': 'application/json' };

  if (contexto.tokenAcceso) {
    cabeceras.Authorization = `Bearer ${contexto.tokenAcceso}`;
  }
  if (contexto.requestId) {
    cabeceras[CABECERA_REQUEST_ID] = contexto.requestId;
  }

  return cabeceras;
}

export class ErrorServicioInterno extends Error {
  constructor(
    readonly status: number,
    readonly servicio: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorServicioInterno';
  }
}

interface RespuestaError {
  mensaje?: string;
  message?: string;
}

/**
 * Cliente mínimo para las llamadas REST entre servicios. Sin reintentos a propósito: reintentar
 * una escritura sin idempotencia hace más daño que fallar rápido.
 */
export class ClienteInterno {
  constructor(
    private readonly nombre: string,
    private readonly baseUrl: string,
    private readonly contexto: () => ContextoPeticion,
  ) {}

  get<T>(ruta: string): Promise<T> {
    return this.pedir<T>(ruta, { method: 'GET' });
  }

  post<T>(ruta: string, cuerpo?: unknown): Promise<T> {
    return this.pedir<T>(ruta, {
      method: 'POST',
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  }

  private async pedir<T>(ruta: string, opciones: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${ruta}`, {
      ...opciones,
      headers: { ...cabecerasInternas(this.contexto()), ...opciones.headers },
    });

    if (!res.ok) {
      const cuerpo = (await res.json().catch(() => null)) as RespuestaError | null;
      throw new ErrorServicioInterno(
        res.status,
        this.nombre,
        cuerpo?.mensaje ?? cuerpo?.message ?? `${this.nombre} respondió ${res.status}`,
      );
    }

    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }
}
