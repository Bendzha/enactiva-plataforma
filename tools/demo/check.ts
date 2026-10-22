/**
 * Revisa que la demo esté lista: los cinco procesos, Mailpit, el login y los datos sembrados.
 *
 * Está pensado para correrlo justo antes de presentar. Falla con código distinto de cero, así
 * que también sirve para darse cuenta de que algo se cayó sin tener que mirar seis terminales.
 */
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import { config } from 'dotenv';
import { EMPRESAS, passwordDemo, TALLERES, TEMAS, USUARIOS, type UsuarioDemo } from './datos.js';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const GATEWAY = process.env.URL_GATEWAY_DEMO ?? 'http://localhost:3000';
const WEB = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

const SERVICIOS = [
  { nombre: 'api-gateway', url: `${GATEWAY}/health` },
  {
    nombre: 'auth-service',
    url: `${process.env.URL_AUTH_SERVICE ?? 'http://localhost:3101'}/health`,
  },
  {
    nombre: 'identity-service',
    url: `${process.env.URL_IDENTITY_SERVICE ?? 'http://localhost:3102'}/health`,
  },
  {
    nombre: 'learning-service',
    url: `${process.env.URL_LEARNING_SERVICE ?? 'http://localhost:3103'}/health`,
  },
  {
    nombre: 'matching-service',
    url: `${process.env.URL_MATCHING_SERVICE ?? 'http://localhost:3104'}/health`,
  },
];

interface Resultado {
  que: string;
  ok: boolean;
  detalle: string;
}

const resultados: Resultado[] = [];

/** El aviso de "esperando" solo tiene sentido en una terminal; en un archivo de log estorba. */
const enTerminal = Boolean(process.stdout.isTTY);

function anotar(que: string, ok: boolean, detalle: string): void {
  resultados.push({ que, ok, detalle });
  // Borra el "…esperando a X" antes de escribir el resultado donde estaba.
  if (enTerminal) process.stdout.write(`\r${' '.repeat(60)}\r`);
  console.log(`${ok ? '  ok  ' : ' FALLA'}  ${que.padEnd(34)} ${detalle}`);
}

async function pedir(url: string, opciones: RequestInit = {}): Promise<Response> {
  const corte = AbortSignal.timeout(5000);
  return fetch(url, { ...opciones, signal: corte });
}

/**
 * Los seis procesos de `pnpm dev` no parten a la vez: el primero responde en un segundo y el
 * último puede tardar veinte. Sin esta espera, correr el check justo después de `pnpm dev`
 * daría un rojo que se arregla solo, que es la peor clase de rojo.
 */
async function esperarA(url: string, nombre: string, hasta = 30000): Promise<boolean> {
  const limite = Date.now() + hasta;
  let aviso = false;
  for (;;) {
    try {
      const res = await pedir(url);
      if (res.ok) {
        const cuerpo = (await res.json()) as { servicio?: string };
        return cuerpo.servicio === nombre;
      }
    } catch {
      // Todavía no levanta.
    }
    if (Date.now() > limite) return false;
    if (!aviso && enTerminal) {
      process.stdout.write(`  …esperando a ${nombre}`);
      aviso = true;
    }
    await new Promise((seguir) => setTimeout(seguir, 1000));
  }
}

async function revisarServicios(): Promise<void> {
  for (const servicio of SERVICIOS) {
    const vivo = await esperarA(servicio.url, servicio.nombre);
    anotar(
      servicio.nombre,
      vivo,
      vivo ? `responde ${servicio.url}` : `no responde en ${servicio.url}`,
    );
  }
}

async function revisarMailpit(): Promise<void> {
  try {
    const res = await pedir(`${MAILPIT}/api/v1/info`);
    anotar('Mailpit', res.ok, res.ok ? `bandeja en ${MAILPIT}` : `HTTP ${res.status}`);
  } catch {
    anotar('Mailpit', false, `no responde en ${MAILPIT}`);
  }
}

async function revisarWeb(): Promise<void> {
  try {
    const res = await pedir(WEB);
    anotar('frontend', res.ok, res.ok ? `abre en ${WEB}` : `HTTP ${res.status}`);
  } catch {
    anotar('frontend', false, `no responde en ${WEB} (¿corriste pnpm dev?)`);
  }
}

/** Login real, por el gateway y con una cuenta de demo: es lo que hará la persona el viernes. */
async function revisarLogin(email: string): Promise<string | null> {
  try {
    const res = await pedir(`${GATEWAY}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: passwordDemo() }),
    });
    if (res.status === 429) {
      anotar(
        `login ${email}`,
        false,
        'límite de intentos por minuto: espera un minuto y vuelve a revisar',
      );
      return null;
    }
    if (res.status === 401) {
      anotar(`login ${email}`, false, '401: ¿corriste pnpm demo:seed con este DEMO_PASSWORD?');
      return null;
    }
    if (!res.ok) {
      anotar(`login ${email}`, false, `HTTP ${res.status}`);
      return null;
    }
    const datos = (await res.json()) as { accessToken?: string };
    anotar(`login ${email}`, Boolean(datos.accessToken), 'entra y recibe su token');
    return datos.accessToken ?? null;
  } catch (error) {
    anotar(`login ${email}`, false, error instanceof Error ? error.message : 'falló');
    return null;
  }
}

async function contar<T>(url: string, token: string, que: string, esperado: number): Promise<T[]> {
  try {
    const res = await pedir(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      anotar(que, false, `HTTP ${res.status}`);
      return [];
    }
    const filas = (await res.json()) as T[];
    anotar(que, filas.length >= esperado, `${filas.length} (esperado al menos ${esperado})`);
    return filas;
  } catch {
    anotar(que, false, 'no se pudo consultar');
    return [];
  }
}

/** Minutos, horas o días según el tamaño: "2.3 min" se lee mejor que "0.04 h". */
function duracion(ms: number): string {
  const minutos = ms / 60000;
  if (minutos < 90) return `${minutos.toFixed(1)} min`;
  if (minutos < 60 * 48) return `${(minutos / 60).toFixed(1)} h`;
  return `${(minutos / 1440).toFixed(1)} días`;
}

function antiguedadDelClon(): string {
  try {
    const git = statSync(fileURLToPath(new URL('../../.git', import.meta.url)));
    const desde = git.birthtimeMs || git.mtimeMs;
    return `${duracion(Date.now() - desde)} desde que se clonó el repositorio`;
  } catch {
    return 'no se pudo leer la fecha del clon';
  }
}

function antiguedadDelSeed(): string {
  try {
    const marca = JSON.parse(
      readFileSync(fileURLToPath(new URL('./.ultimo-seed.json', import.meta.url)), 'utf8'),
    ) as { sembradoAt: string };
    return `sembrada hace ${duracion(Date.now() - Date.parse(marca.sembradoAt))}`;
  } catch {
    return 'sin marca de siembra (corre pnpm demo:seed)';
  }
}

async function main() {
  const empezo = Date.now();
  console.log('\nRevisando la demo\n');

  await revisarServicios();
  await revisarMailpit();
  await revisarWeb();

  const cuenta = (papel: UsuarioDemo['papel']) => USUARIOS.find((u) => u.papel === papel)!;
  const rrhh = cuenta('rrhh');

  // Los mínimos salen de los mismos datos que siembra el seed: si mañana se agrega una persona
  // al archivo de datos, el check la exige sola.
  const dePlantaNorte = EMPRESAS.plantaNorte.id;
  const personasEsperadas = USUARIOS.filter((u) => u.empresaId === dePlantaNorte).length;
  const temasEsperados = Object.values(TEMAS).filter((t) => t.empresaId === dePlantaNorte).length;
  const talleresEsperados = TALLERES.filter((t) => t.enDias >= 0).length;

  const tokenRrhh = await revisarLogin(rrhh.email);

  if (tokenRrhh) {
    await contar(
      `${GATEWAY}/identity/personas`,
      tokenRrhh,
      'personas de la empresa',
      personasEsperadas,
    );
    await contar(`${GATEWAY}/identity/temas`, tokenRrhh, 'temas en el catálogo', temasEsperados);

    const talleres = await contar<{ inscritos: number }>(
      `${GATEWAY}/learning/talleres`,
      tokenRrhh,
      'talleres convocados',
      talleresEsperados,
    );
    const inscritos = talleres.reduce((suma, taller) => suma + taller.inscritos, 0);
    anotar('inscripciones en esos talleres', inscritos > 0, `${inscritos} personas inscritas`);
  }

  const fallas = resultados.filter((r) => !r.ok);
  console.log('');
  console.log(`  ${antiguedadDelClon()}`);
  console.log(`  Demo ${antiguedadDelSeed()}`);
  console.log(`  Revisión hecha en ${((Date.now() - empezo) / 1000).toFixed(1)} s`);
  console.log('');

  if (fallas.length > 0) {
    console.log(`${fallas.length} de ${resultados.length} revisiones fallaron:`);
    for (const falla of fallas) {
      console.log(`  - ${falla.que}: ${falla.detalle}`);
    }
    console.log('\nEl runbook está en docs/DEMO.md.');
    process.exit(1);
  }

  console.log(`Todo en orden: ${resultados.length} revisiones.`);
  console.log(`Entra en ${WEB} con las cuentas de docs/DEMO.md.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
