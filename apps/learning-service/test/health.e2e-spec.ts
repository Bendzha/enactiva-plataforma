import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('learning-service (e2e)', () => {
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

    expect(res.body).toMatchObject({ status: 'ok', servicio: 'learning-service' });
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });

  it('devuelve un identificador de petición para poder seguirla entre servicios', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);

    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('responde 404 en una ruta inexistente', async () => {
    await request(app.getHttpServer()).get('/no-existe').expect(404);
  });
});
