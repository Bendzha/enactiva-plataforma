import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const LIMITE = 3;

// Archivo aparte: fija el límite ANTES de importar la app, porque el decorador
// @Throttle lee la configuración al cargar el controlador.
describe('Límite de intentos de login (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.LOGIN_INTENTOS_POR_MINUTO = String(LIMITE);
    const { limpiarCacheEnv } = await import('../src/config/env.js');
    limpiarCacheEnv();
    const { AppModule } = await import('../src/app.module.js');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it(`bloquea con 429 después de ${LIMITE} intentos fallidos en un minuto`, async () => {
    const intentar = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'fuerza.bruta@plataforma.local', password: 'intento-incorrecto' });

    const codigos: number[] = [];
    for (let i = 0; i < LIMITE + 2; i++) {
      codigos.push((await intentar()).status);
    }

    expect(codigos.slice(0, LIMITE)).toEqual(Array(LIMITE).fill(401));
    expect(codigos.at(-1)).toBe(429);
  });
});
