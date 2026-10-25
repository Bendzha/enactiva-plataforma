import { defineConfig } from 'vitest/config';

// Tests e2e: levantan el servicio completo y lo recorren con Supertest.
// La configuración se carga sola: `src/config/env.ts` lee el .env de la raíz al importarse.
export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    // Cinco segundos (el valor por defecto) es un presupuesto irreal para lo que hacen estos
    // tests: abren el servicio, escriben en Postgres y en varios casos mandan un correo de
    // verdad por SMTP. En una máquina cargada eso pasa de cinco segundos sin que nada esté
    // mal, y la CI se ponía roja por lentitud (run #31). Las aserciones no cambian: un correo
    // que nunca llega sigue fallando, solo que ahora el test espera lo que de verdad tarda.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
