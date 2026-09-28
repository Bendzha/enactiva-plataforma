import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('api-gateway (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde 200 diciendo qué servicio contestó', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.body).toMatchObject({ status: 'ok', servicio: 'api-gateway' });
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('genera el identificador que después siguen todos los servicios', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('responde 404 en una ruta inexistente', async () => {
    // En M2 estas rutas dejan de ser 404 y pasan a enrutarse hacia cada servicio.
    await request(app.getHttpServer()).get('/identity/empresas').expect(404);
  });
});
