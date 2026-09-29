import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AVISO_PRIVACIDAD_VERSION } from '@enactiva/shared';
import cookieParser from 'cookie-parser';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

/**
 * Integración real entre auth-service e identity-service (ADR-0007).
 *
 * Levanta identity en un puerto efímero y apunta auth hacia él, en vez de simularlo: lo que hay
 * que comprobar es justamente que la conversación entre los dos servicios funciona — que el 401
 * por credenciales inválidas llega al navegador como 401, que la rotación del refresh detecta el
 * reuso y que la activación de una invitación termina en una sesión iniciada.
 *
 * El import relativo a identity-service es a propósito y solo de tests: auth-service no depende
 * de él en tiempo de ejecución, solo habla por HTTP.
 */

const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_ACTIVO = 'auth.activo@plataforma.local';
const EMAIL_INVITADO = 'auth.invitado@plataforma.local';
const EMAILS = [EMAIL_ACTIVO, EMAIL_INVITADO];

const ALMACEN_SIN_LIMITE = {
  increment: async () => ({
    totalHits: 1,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
};

/** Extrae una cookie del encabezado Set-Cookie para reenviarla en la siguiente petición. */
function cookieDe(res: request.Response, nombre: string): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cruda = (cookies ?? []).find((c) => c.startsWith(`${nombre}=`)) ?? '';
  return cruda.split(';')[0] ?? '';
}

describe('Autenticación entre auth-service e identity-service (e2e)', () => {
  let identityApp: INestApplication;
  let authApp: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  let hashToken: (token: string) => string;
  let invitacionToken: string;

  beforeAll(async () => {
    const { AppModule: IdentityAppModule } = await import('identity-service/src/app.module.js');
    const { PrismaService } = await import('identity-service/src/prisma/prisma.service.js');
    const tokens = await import('identity-service/src/common/tokens.js');
    hashToken = tokens.hashToken;

    const identityRef = await Test.createTestingModule({ imports: [IdentityAppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();
    identityApp = identityRef.createNestApplication();
    await identityApp.listen(0);
    prisma = identityApp.get(PrismaService);

    const { port } = identityApp.getHttpServer().address() as AddressInfo;
    // Se fija ANTES de importar el módulo de auth: su configuración se lee al importarlo.
    process.env.URL_IDENTITY_SERVICE = `http://localhost:${port}`;

    const { AppModule } = await import('../src/app.module.js');
    const authRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();
    authApp = authRef.createNestApplication();
    authApp.use(cookieParser());
    await authApp.init();

    await limpiar();

    const { hashPassword } = await import('identity-service/src/common/password.js');
    await prisma.usuario.create({
      data: {
        email: EMAIL_ACTIVO,
        passwordHash: await hashPassword(PASSWORD_PRUEBA),
        estado: 'ACTIVO',
        nivelAdmin: 'PRINCIPAL',
        roles: { create: { rol: 'ADMIN_ENACTIVA' } },
      },
    });

    invitacionToken = 'token-de-invitacion-de-prueba-para-auth';
    await prisma.usuario.create({
      data: {
        email: EMAIL_INVITADO,
        estado: 'INVITADO',
        nivelAdmin: 'OPERATIVO',
        roles: { create: { rol: 'ADMIN_ENACTIVA' } },
        tokens: {
          create: {
            tipo: 'INVITACION',
            tokenHash: hashToken(invitacionToken),
            expiraAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
  });

  const limpiar = async () => {
    await prisma.usuario.deleteMany({ where: { email: { in: EMAILS } } });
  };

  afterAll(async () => {
    await limpiar();
    await authApp.close();
    await identityApp.close();
  });

  const servidor = () => authApp.getHttpServer();

  it('inicia sesión y devuelve el token y la cookie de refresh', async () => {
    const res = await request(servidor())
      .post('/auth/login')
      .send({ email: EMAIL_ACTIVO, password: PASSWORD_PRUEBA })
      .expect(200);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.usuario).toMatchObject({ email: EMAIL_ACTIVO, nivelAdmin: 'PRINCIPAL' });
    // El hash de la contraseña se queda en identity-service y no viaja en ninguna respuesta.
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const cookie = cookieDe(res, 'refresh_token');
    expect(cookie).not.toBe('');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('Path=/auth');
  });

  it('una contraseña incorrecta responde 401, no 500', async () => {
    // El 401 nace en identity-service; el filtro de auth lo traduce sin disfrazarlo de error.
    await request(servidor())
      .post('/auth/login')
      .send({ email: EMAIL_ACTIVO, password: 'clave-equivocada-larga' })
      .expect(401);
  });

  it('un email que no existe responde igual que una contraseña mala', async () => {
    await request(servidor())
      .post('/auth/login')
      .send({ email: 'nadie@plataforma.local', password: PASSWORD_PRUEBA })
      .expect(401);
  });

  it('rechaza datos inválidos antes de llamar a identity', async () => {
    const res = await request(servidor())
      .post('/auth/login')
      .send({ email: 'no-es-un-email', password: '' })
      .expect(400);

    expect(res.body.mensaje).toBe('Datos inválidos');
  });

  it('rota el refresh y detecta el reuso del token anterior', async () => {
    const login = await request(servidor())
      .post('/auth/login')
      .send({ email: EMAIL_ACTIVO, password: PASSWORD_PRUEBA })
      .expect(200);
    const primera = cookieDe(login, 'refresh_token');

    const refresco = await request(servidor())
      .post('/auth/refresh')
      .set('Cookie', primera)
      .expect(200);
    expect(refresco.body.accessToken).toBeTruthy();
    const segunda = cookieDe(refresco, 'refresh_token');
    expect(segunda).not.toBe(primera);

    // Reusar el token ya rotado se interpreta como robo: se cierran todas las sesiones.
    await request(servidor()).post('/auth/refresh').set('Cookie', primera).expect(401);
    await request(servidor()).post('/auth/refresh').set('Cookie', segunda).expect(401);
  });

  it('sin cookie de refresh responde 401', async () => {
    await request(servidor()).post('/auth/refresh').expect(401);
  });

  it('cierra la sesión y borra la cookie', async () => {
    const login = await request(servidor())
      .post('/auth/login')
      .send({ email: EMAIL_ACTIVO, password: PASSWORD_PRUEBA })
      .expect(200);
    const cookie = cookieDe(login, 'refresh_token');

    await request(servidor()).post('/auth/logout').set('Cookie', cookie).expect(204);
    await request(servidor()).post('/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('GET /auth/yo devuelve el perfil leído de identity', async () => {
    await request(servidor()).get('/auth/yo').expect(401);

    const login = await request(servidor())
      .post('/auth/login')
      .send({ email: EMAIL_ACTIVO, password: PASSWORD_PRUEBA })
      .expect(200);

    const res = await request(servidor())
      .get('/auth/yo')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ email: EMAIL_ACTIVO, nivelAdmin: 'PRINCIPAL' });
    expect(res.body.roles).toContain('ADMIN_ENACTIVA');
  });

  it('acepta una invitación y deja la sesión iniciada', async () => {
    const res = await request(servidor())
      .post('/auth/invitaciones/aceptar')
      .send({
        token: invitacionToken,
        nombre: 'Carla',
        apellido: 'Soto',
        password: 'otra-clave-de-prueba-larga',
        aceptaAviso: true,
      })
      .expect(200);

    expect(res.body.usuario).toMatchObject({ nombre: 'Carla', apellido: 'Soto' });
    expect(cookieDe(res, 'refresh_token')).not.toBe('');

    // La transacción de identity dejó la cuenta activa y la aceptación del aviso registrada.
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_INVITADO },
      include: { aceptaciones: true },
    });
    expect(usuario.estado).toBe('ACTIVO');
    expect(usuario.aceptaciones[0].versionAviso).toBe(AVISO_PRIVACIDAD_VERSION);

    // Y el token no sirve una segunda vez.
    await request(servidor())
      .post('/auth/invitaciones/aceptar')
      .send({
        token: invitacionToken,
        nombre: 'Otra',
        apellido: 'Persona',
        password: 'tercera-clave-de-prueba',
        aceptaAviso: true,
      })
      .expect(410);
  });

  it('sin aceptar el aviso de privacidad no se puede activar la cuenta', async () => {
    await request(servidor())
      .post('/auth/invitaciones/aceptar')
      .send({
        token: 'da-lo-mismo',
        nombre: 'Sin',
        apellido: 'Aviso',
        password: 'clave-de-prueba-larga-x',
        aceptaAviso: false,
      })
      .expect(400);
  });
});
