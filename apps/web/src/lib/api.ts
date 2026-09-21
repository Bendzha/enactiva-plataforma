const URL_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * El access token vive solo en memoria: si se guardara en localStorage, cualquier script
 * inyectado en la página podría leerlo. La sesión se recupera al recargar con la cookie
 * de refresh, que el JavaScript de la página no puede leer (ADR-0003).
 */
let accessToken: string | null = null;

export function guardarToken(token: string | null): void {
  accessToken = token;
}

export function hayToken(): boolean {
  return accessToken !== null;
}

export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

interface RespuestaError {
  mensaje?: string;
  message?: string;
}

async function ejecutar(ruta: string, opciones: RequestInit): Promise<Response> {
  return fetch(`${URL_API}${ruta}`, {
    ...opciones,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...opciones.headers,
    },
  });
}

async function aError(res: Response): Promise<ErrorApi> {
  const cuerpo = (await res.json().catch(() => null)) as RespuestaError | null;
  return new ErrorApi(res.status, cuerpo?.mensaje ?? cuerpo?.message ?? 'Error inesperado');
}

/**
 * Llama a la API. Si el access token expiró (401), intenta renovarlo una vez con la cookie
 * de refresh y repite la petición; así una sesión larga no bota al usuario cada 15 minutos.
 */
export async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let res = await ejecutar(ruta, opciones);

  if (res.status === 401 && accessToken && ruta !== '/auth/refresh') {
    const renovado = await renovarSesion();
    if (!renovado) throw await aError(res);
    res = await ejecutar(ruta, opciones);
  }

  if (!res.ok) throw await aError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

interface RespuestaSesion {
  accessToken: string;
  usuario: unknown;
}

/** Devuelve el usuario de la sesión renovada, o null si no hay sesión válida. */
export async function renovarSesion(): Promise<unknown | null> {
  const res = await ejecutar('/auth/refresh', { method: 'POST' });
  if (!res.ok) {
    guardarToken(null);
    return null;
  }
  const datos = (await res.json()) as RespuestaSesion;
  guardarToken(datos.accessToken);
  return datos.usuario;
}
