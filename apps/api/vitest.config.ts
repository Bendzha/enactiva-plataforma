import { defineConfig } from 'vitest/config';

// Tests unitarios: reglas de dominio y servicios aislados.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
