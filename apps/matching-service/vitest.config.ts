import { defineConfig } from 'vitest/config';

// Tests unitarios: reglas de dominio y servicios aislados.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // En la fase M0 este servicio solo tiene /health y su e2e; los unitarios llegan con la
    // lógica en M1. Sin esto, vitest falla por no encontrar archivos.
    passWithNoTests: true,
  },
});
