import { defineConfig } from 'vitest/config';

// Tests e2e: levantan el servicio completo y lo recorren con Supertest.
// La configuración se carga sola: `src/config/env.ts` lee el .env de la raíz al importarse.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
});
