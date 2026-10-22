/**
 * Devuelve la demo a su estado inicial recreando las tres bases.
 *
 * No borra filas: el registro de auditoría es append-only y un trigger en la base rechaza
 * DELETE (ADR-0002, Ley 21.719). Intentar limpiarlo a mano fallaría, y dejarlo con los rastros
 * de la demo anterior tampoco es "estado inicial". Recrear la base es la única forma honesta.
 *
 * Por lo mismo es destructivo, así que exige una variable explícita: nadie lo corre por accidente
 * creyendo que limpia un par de tablas.
 */
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

const BASES = [
  { base: 'identity_db', rol: 'svc_identity' },
  { base: 'learning_db', rol: 'svc_learning' },
  { base: 'matching_db', rol: 'svc_matching' },
];

function exigirPermiso(): void {
  if (process.env.PERMITIR_RESET_DEMO !== 'si') {
    console.error(
      [
        'Este comando BORRA identity_db, learning_db y matching_db y las vuelve a crear.',
        '',
        'Si es lo que quieres, agrega esta línea a tu .env:',
        '',
        '    PERMITIR_RESET_DEMO=si',
        '',
        'Está pedido a propósito: no hay vuelta atrás y se lleva también la auditoría.',
      ].join('\n'),
    );
    process.exit(1);
  }
}

function correr(comando: string, descripcion: string): void {
  console.log(`\n→ ${descripcion}`);
  execSync(comando, { cwd: RAIZ, stdio: 'inherit' });
}

function recrearBases(): void {
  const sql = [
    ...BASES.map(({ base }) => `DROP DATABASE IF EXISTS "${base}" WITH (FORCE);`),
    ...BASES.map(({ base, rol }) => `CREATE DATABASE "${base}" OWNER "${rol}";`),
    // El aislamiento entre servicios se vuelve a aplicar: una base nueva nace abierta a PUBLIC.
    ...BASES.flatMap(({ base, rol }) => [
      `REVOKE CONNECT ON DATABASE "${base}" FROM PUBLIC;`,
      `GRANT CONNECT ON DATABASE "${base}" TO "${rol}";`,
    ]),
  ].join('\n');

  console.log('\n→ Recreando las tres bases');
  try {
    execFileSync(
      'docker',
      [
        'compose',
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'enactiva',
        '-d',
        'postgres',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        '-',
      ],
      { cwd: RAIZ, input: sql, stdio: ['pipe', 'inherit', 'inherit'] },
    );
  } catch {
    console.error(
      '\nNo se pudieron recrear las bases. ¿Está Postgres arriba?\n' +
        '    docker compose up -d --wait',
    );
    process.exit(1);
  }
}

function main(): void {
  exigirPermiso();
  const empezo = Date.now();

  recrearBases();
  correr('pnpm --filter identity-service db:deploy', 'Migrando identity_db');
  correr('pnpm --filter learning-service db:deploy', 'Migrando learning_db');

  // El Admin Principal real es opcional: la demo trae el suyo. Si alguien configuró el suyo
  // propio en el .env, se vuelve a crear; si no, no pasa nada.
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    correr('pnpm --filter identity-service db:seed', 'Creando el Admin Principal del .env');
  } else {
    console.log('\n→ Sin SEED_ADMIN_* en el .env: se omite el Admin Principal propio.');
  }

  correr('pnpm demo:seed', 'Sembrando los datos de la demo');

  console.log(`\nDemo reiniciada en ${((Date.now() - empezo) / 1000).toFixed(0)} s.`);
  console.log('Si tenías `pnpm dev` corriendo, reinícialo: sus conexiones quedaron en el aire.');
}

main();
