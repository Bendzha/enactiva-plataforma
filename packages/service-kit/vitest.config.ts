import { defineConfig } from 'vitest/config';

// Infraestructura compartida: se prueba sin base de datos y sin red.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
  },
});
