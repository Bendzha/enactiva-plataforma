import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

/**
 * El gateway con los servicios reales detrás (ADR-0007).
 *
 * Levanta identity y auth en puertos efímeros y comprueba lo que solo se ve de punta a punta:
 * que el prefijo lleva a su servicio, que el cuerpo y las cookies viajan enteros, y que
 * `/interno/*` no se alcanza desde afuera.
 */

const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL = 'gateway.prueba@plataforma.local';

const ALMACEN_SIN_LIMITE = {
  increment: async () => ({
    totalHits: 1,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
};

describe('API Gateway (e2e)', () => {
  let identityApp: INestApplication;
  let authApp: INestApplication;
  let gateway: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

  beforeAll(async () => {
    const { AppModule: IdentityAppModule } = await import('identity-service/src/app.module.js');
    const { PrismaService } = await import('identity-service/src/prisma/prisma.service.js');
    const { hashPassword } = await import('identity-service/src/common/password.js');

    const identityRef = await Test.createTestingModule({ imports: [IdentityAppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();
    identityApp = identityRef.createNestApplication();
    await identityApp.listen(0);
    prisma = identityApp.get(PrismaService);

    const puertoIdentity = (identityApp.getHttpServer().address() as AddressInfo).port;
    process.env.URL_IDENTITY_SERVICE = `http://localhost:${puertoIdentity}`;

    const { AppModule: AuthAppModule } = await import('auth-service/src/app.module.js');
    const authRef = await Test.createTestingModule({ imports: [AuthAppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();
    authApp = authRef.createNestApplication();
    const cookieParser = (await import('cookie-parser')).default;
    authApp.use(cookieParser());
    await authApp.listen(0);

    const puertoAuth = (authApp.getHttpServer().address() as AddressInfo).port;
    process.env.URL_AUTH_SERVICE = `http://localhost:${puertoAuth}`;

    // learning y matching se apuntan a un puerto cerrado a propósito. Así el test no depende de
    // si esos servicios están corriendo en la máquina de quien lo ejecuta, y un 502 significa
    // siempre lo mismo: el gateway reconoció el prefijo e intentó conectarse.
    process.env.URL_LEARNING_SERVICE = 'http://127.0.0.1:1';
    process.env.URL_MATCHING_SERVICE = 'http://127.0.0.1:1';

    // El gateway se importa al final: su configuración se lee al cargar el módulo.
    const { limpiarCacheEnv } = await import('../src/config/env.js');
    limpiarCacheEnv();
    const { AppModule } = await import('../src/app.module.js');
    const { configurarGateway } = await import('../src/configurar.js');

    const gatewayRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    gateway = gatewayRef.createNestApplication({ bodyParser: false });
    configurarGateway(gateway);
    await gateway.init();

    await limpiar();
    await prisma.usuario.create({
      data: {
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD_PRUEBA),
        estado: 'ACTIVO',
        nivelAdmin: 'PRINCIPAL',
        roles: { create: { rol: 'ADMIN_ENACTIVA' } },
      },
    });
  });

  const limpiar = async () => {
    await prisma.usuario.deleteMany({ where: { email: EMAIL } });
  };

  afterAll(async () => {
    await limpiar();
    await gateway.close();
    await authApp.close();
    await identityApp.close();
  });

  const servidor = () => gateway.getHttpServer();

  it('responde su propio /health sin enrutar a nadie', async () => {
    const res = await request(servidor()).get('/health').expect(200);
    expect(res.body).toMatchObject({ servicio: 'api-gateway' });
  });

  it('enruta /auth al servicio de autenticación, con cuerpo y cookie', async () => {
    const res = await request(servidor())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD_PRUEBA })
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.usuario.email).toBe(EMAIL);

    // La cookie de refresh vuelve entera a través del proxy, con su path original.
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('Path=/auth');
  });

  it('enruta /identity quitando el prefijo', async () => {
    const login = await request(servidor())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD_PRUEBA })
      .expect(200);

    await request(servidor())
      .get('/identity/empresas')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
  });

  it('propaga el 401 del servicio en vez de convertirlo en otra cosa', async () => {
    await request(servidor()).get('/identity/empresas').expect(401);
  });

  it('reconoce /learning y /matching e intenta conectarse a sus servicios', async () => {
    // Apuntan a un puerto cerrado: un 502 dice que el gateway reconoció el prefijo e intentó
    // conectarse. Si no lo reconociera, respondería 404 él mismo.
    const learning = await request(servidor()).get('/learning/cursos').expect(502);
    expect(learning.body.mensaje).toMatch(/no está disponible/i);

    await request(servidor()).get('/matching/mazo').expect(502);
  });

  it('no conoce las rutas sin prefijo', async () => {
    await request(servidor()).get('/empresas').expect(404);
  });

  it('no deja alcanzar las rutas internas desde afuera', async () => {
    // Sin esto, el prefijo se quitaría y la petición llegaría al endpoint interno de identity.
    await request(servidor())
      .post('/identity/interno/sesiones/login')
      .send({ email: EMAIL, password: PASSWORD_PRUEBA })
      .expect(404);

    await request(servidor()).get('/identity/interno/sesiones/actual').expect(404);
  });

  it('genera el identificador de petición y respeta el que le manden', async () => {
    const generado = await request(servidor()).get('/health').expect(200);
    expect(generado.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const propagado = await request(servidor())
      .get('/identity/empresas')
      .set('x-request-id', 'seguimiento-de-prueba');
    expect(propagado.headers['x-request-id']).toBe('seguimiento-de-prueba');
  });
});
