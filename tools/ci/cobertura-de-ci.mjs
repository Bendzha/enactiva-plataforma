/**
 * Que ningún workspace con tests quede fuera del pipeline.
 *
 * CI corre los tests **filtrados por workspace** (un job por servicio, ADR-0007). Agregar un
 * paquete nuevo con su `test` y olvidar el filtro lo deja sin correr nunca, con CI en verde. Ese
 * silencio es peor que no tener CI: nadie revisa un check que pasa.
 *
 * No alcanza con buscar el nombre en el archivo: `matching-service` también aparece en el paso
 * que migra su base, así que sacarlo de la matriz no se notaría. Lo que se compara son los
 * workspaces que de verdad reciben un `pnpm --filter … test`, con la matriz ya expandida.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` y no `.pathname`: en Windows ese atributo devuelve "/C:/…" y la ruta queda
// inservible al unirla.
const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const WORKFLOW = '.github/workflows/ci.yml';
const CARPETAS = ['apps', 'packages', 'tools'];

const workflow = readFileSync(join(RAIZ, WORKFLOW), 'utf8');

/** Workspaces que declaran un script `test` en su package.json. */
function conTests() {
  const encontrados = [];
  for (const carpeta of CARPETAS) {
    const base = join(RAIZ, carpeta);
    if (!existsSync(base)) continue;

    for (const entrada of readdirSync(base, { withFileTypes: true })) {
      if (!entrada.isDirectory()) continue;

      const manifiesto = join(base, entrada.name, 'package.json');
      if (!existsSync(manifiesto)) continue;

      const paquete = JSON.parse(readFileSync(manifiesto, 'utf8'));
      if (paquete.scripts?.test) encontrados.push(paquete.name);
    }
  }
  return encontrados;
}

/** Los valores de `matrix.<clave>`, para poder resolver `${{ matrix.<clave> }}` más abajo. */
function valoresDeMatriz(clave) {
  const bloque = new RegExp(`^\\s*${clave}:\\s*$((?:\\s*#.*$|\\s*-\\s+\\S+\\s*$)+)`, 'm');
  const encontrado = bloque.exec(workflow);
  if (!encontrado) return [];

  return [...encontrado[1].matchAll(/^\s*-\s+(\S+)\s*$/gm)].map((fila) => fila[1]);
}

/** Workspaces a los que el workflow les corre los tests. */
function cubiertosPorCI() {
  const cubiertos = new Set();

  // Cada línea que invoca tests, con todos sus `--filter`. Un `--filter` suelto no basta: el que
  // migra una base también lleva uno y no corre ningún test.
  for (const linea of workflow.split('\n')) {
    if (!/\btest\b/.test(linea) || !linea.includes('--filter')) continue;

    // `${{ matrix.servicio }}` lleva espacios adentro, así que no se puede leer como `\S+`.
    for (const [, destino] of linea.matchAll(/--filter\s+(\$\{\{[^}]*\}\}|\S+)/g)) {
      const matriz = /^\$\{\{\s*matrix\.(\w+)\s*\}\}$/.exec(destino);
      if (matriz) {
        for (const valor of valoresDeMatriz(matriz[1])) cubiertos.add(valor);
      } else {
        cubiertos.add(destino);
      }
    }
  }

  return cubiertos;
}

const cubiertos = cubiertosPorCI();
const todos = conTests();
const olvidados = todos.filter((nombre) => !cubiertos.has(nombre));

if (olvidados.length > 0) {
  console.error(
    [
      `Estos workspaces tienen tests y ${WORKFLOW} no los corre:`,
      ...olvidados.map((nombre) => `  - ${nombre}`),
      '',
      'Dales un job —o agrégalos a uno existente— antes de seguir: si no, sus tests no corren',
      'en ningún PR y CI igual queda en verde.',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`CI corre los tests de los ${todos.length} workspaces que los tienen.`);
