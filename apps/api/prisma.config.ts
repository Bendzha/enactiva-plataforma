import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // process.env en vez de env(): `prisma generate` no necesita base de datos y no debe fallar sin .env
    url: process.env.DATABASE_URL ?? '',
  },
});
