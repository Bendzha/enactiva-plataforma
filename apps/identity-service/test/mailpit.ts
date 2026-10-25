/**
 * Lo que los tests necesitan de Mailpit, en un solo lugar.
 *
 * Antes cada archivo tenía su copia de estos helpers y todos leían la bandeja **de inmediato**,
 * dando por hecho que el correo ya había llegado. Casi siempre es cierto y por eso pasaba; en
 * una máquina cargada no, y la CI se ponía roja sin que nada estuviera mal (run #31).
 *
 * `esperarCorreos` reintenta hasta que aparezcan los que se esperan. Sigue fallando si el correo
 * nunca llega —que es lo que el test quiere comprobar—, pero deja de fallar por llegar tarde.
 */
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

export interface MensajeMailpit {
  ID: string;
  Subject: string;
}

export function vaciarBandeja(): Promise<Response> {
  return fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
}

/** Lo que hay ahora mismo, sin esperar nada. */
export async function buscarCorreos(email: string): Promise<MensajeMailpit[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const datos = (await res.json()) as { messages?: MensajeMailpit[] };
  return datos.messages ?? [];
}

/**
 * Espera a que la bandeja tenga al menos `cuantos` correos para esa dirección.
 *
 * Devuelve lo que encontró, aunque sean menos: la aserción del test es la que decide si eso
 * está bien o mal. Así el error dice "esperaba 2, llegó 1" y no "se acabó el tiempo".
 */
export async function esperarCorreos(
  email: string,
  cuantos = 1,
  hasta = 10_000,
): Promise<MensajeMailpit[]> {
  const limite = Date.now() + hasta;
  let encontrados = await buscarCorreos(email);

  while (encontrados.length < cuantos && Date.now() < limite) {
    await new Promise((seguir) => setTimeout(seguir, 150));
    encontrados = await buscarCorreos(email);
  }

  return encontrados;
}

/** El contenido del correo, HTML y texto juntos, para buscar un enlace dentro. */
export async function cuerpoDelCorreo(id: string): Promise<string> {
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const datos = (await res.json()) as { HTML?: string; Text?: string };
  return `${datos.HTML ?? ''}${datos.Text ?? ''}`;
}

/**
 * El token de activación que viaja en el enlace del correo.
 * Espera a que el correo llegue antes de buscarlo.
 */
export async function tokenDesdeElCorreo(email: string): Promise<string> {
  const [mensaje] = await esperarCorreos(email);
  if (!mensaje) {
    throw new Error(`No llegó ningún correo para ${email}`);
  }
  const enlace = /\/activar\?token=([A-Za-z0-9_-]+)/.exec(await cuerpoDelCorreo(mensaje.ID));
  if (!enlace?.[1]) {
    throw new Error(`El correo para ${email} no trae un enlace de activación`);
  }
  return enlace[1];
}
