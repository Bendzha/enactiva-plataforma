/**
 * Siembra los datos de la demo en las dos bases que los necesitan.
 *
 * Primero identity (personas y temas) y después learning (talleres), porque un taller cuelga de
 * un tema y de un facilitador. Como los ids son fijos, correrlo dos veces no duplica nada.
 */
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { sembrarIdentity } from './seed-identity.js';
import { sembrarLearning } from './seed-learning.js';

const MARCA = fileURLToPath(new URL('./.ultimo-seed.json', import.meta.url));

async function main() {
  const empezo = Date.now();

  await sembrarIdentity();
  await sembrarLearning();

  // La marca la lee `demo:check` para decir hace cuánto se sembró. No va al repositorio.
  writeFileSync(MARCA, JSON.stringify({ sembradoAt: new Date().toISOString() }, null, 2) + '\n');

  console.log(`\nDemo sembrada en ${((Date.now() - empezo) / 1000).toFixed(1)} s.`);
  console.log('Las cuentas y la contraseña están en docs/DEMO.md.');
}

main().catch((error: unknown) => {
  console.error('\nNo se pudo sembrar la demo:\n');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
