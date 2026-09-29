import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

const LIMITE = 3;

/**
 * Archivo aparte: fija el límite ANTES de importar la app, porque el decorador `@Throttle` lee
 * la configuración al cargar el controlador.
 *
 * El límite protege el login de la fuerza bruta y vive en auth-service, que es quien lo expone;
 * identity-service tiene el suyo, más alto, para el resto de sus rutas (ADR-0007).
 */
describe('Límite de intentos de login (e2e)', () => {
  let identityApp: INestApplication;
  let app: INestApplication;

  beforeAll(async () => {
    const { AppModule: IdentityAppModule } = await import('identity-service/src/app.module.js');
    const identityRef = await Test.createTestingModule({ imports: [IdentityAppModule] }).compile();
    identityApp = identityRef.createNestApplication();
    await identityApp.listen(0);

    const { port } = identityApp.getHttpServer().address() as AddressInfo;
    process.env.URL_IDENTITY_SERVICE = `http://localhost:${port}`;
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
    await identityApp.close();
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
