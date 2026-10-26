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

/** Saca el nombre del archivo de `Content-Disposition`, que es donde lo pone el servidor. */
function nombreDeArchivo(res: Response): string | null {
  const cabecera = res.headers.get('content-disposition');
  return /filename="([^"]+)"/.exec(cabecera ?? '')?.[1] ?? null;
}

/**
 * Igual que `pedir`, pero devuelve el archivo tal como vino.
 *
 * La exportación de datos personales no es un JSON para mostrar en pantalla: es un archivo que
 * la persona se lleva (Ley 21.719), y hasta su nombre lo decide el servidor.
 */
export async function descargar(ruta: string): Promise<{ blob: Blob; nombre: string }> {
  let res = await ejecutar(ruta, {});

  if (res.status === 401 && accessToken) {
    const renovado = await renovarSesion();
    if (!renovado) throw await aError(res);
    res = await ejecutar(ruta, {});
  }

  if (!res.ok) throw await aError(res);
  return { blob: await res.blob(), nombre: nombreDeArchivo(res) ?? 'mis-datos.json' };
}

interface RespuestaSesion {
  accessToken: string;
  usuario: unknown;
}

/**
 * Renovación en curso, si la hay.
 *
 * El refresh es de **un solo uso** y se rota en cada llamada (ADR-0003). Si dos partes de la
 * página lo renuevan a la vez —el proveedor de sesión al montar y una consulta que recibió 401,
 * o React montando dos veces en desarrollo—, la segunda llega con un token ya rotado. Para el
 * servidor eso es exactamente lo que parece un token robado: responde 401 y corta **todas** las
 * sesiones de esa persona. El síntoma es volver al login al recargar la página.
 *
 * Por eso solo puede haber una renovación a la vez: quien llegue mientras otra está en curso
 * espera la misma respuesta.
 */
let renovacionEnCurso: Promise<unknown | null> | null = null;

/** Devuelve el usuario de la sesión renovada, o null si no hay sesión válida. */
export function renovarSesion(): Promise<unknown | null> {
  renovacionEnCurso ??= renovar().finally(() => {
    renovacionEnCurso = null;
  });
  return renovacionEnCurso;
}

async function renovar(): Promise<unknown | null> {
  const res = await ejecutar('/auth/refresh', { method: 'POST' });
  if (!res.ok) {
    guardarToken(null);
    return null;
  }
  const datos = (await res.json()) as RespuestaSesion;
  guardarToken(datos.accessToken);
  return datos.usuario;
}
