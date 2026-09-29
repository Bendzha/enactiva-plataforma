import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// La configuración vive en el .env de la raíz del monorepo (ADR-0007). Aquí se resuelve con una
// ruta explícita porque Prisma ejecuta este archivo desde la carpeta del servicio.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // process.env en vez de env(): `prisma generate` no necesita base de datos y no debe fallar
    // sin .env.
    url: process.env.DATABASE_URL_IDENTITY ?? '',
  },
});
