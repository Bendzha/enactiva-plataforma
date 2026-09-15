import { defineConfig } from 'vitest/config';

// Tests e2e: levantan la aplicación Nest completa y la recorren con Supertest.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
  },
});
