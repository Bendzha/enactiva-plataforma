import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
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

/** El Set-Cookie completo, con sus atributos: es ahí donde se ve si lleva vencimiento. */
function cookieCrudaDe(res: request.Response, nombre: string): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (cookies ?? []).find((c) => c.startsWith(`${nombre}=`)) ?? '';
}

/** Extrae una cookie del encabezado Set-Cookie para reenviarla en la siguiente petición. */
function cookieDe(res: request.Response, nombre: string): string {
  return cookieCrudaDe(res, nombre).split(';')[0] ?? '';
}

/**
 * Una cookie **de sesión** es la que no lleva ni `Expires` ni `Max-Age`: el navegador la borra
 * al cerrarse. No es lo mismo que una con fecha pasada, que la borraría de inmediato.
 */
function muereConElNavegador(cookieCruda: string): boolean {
  return !/expires=|max-age=/i.test(cookieCruda);
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

  describe('«mantener sesión iniciada» (SPEC §3.9)', () => {
    const entrar = (mantenerSesion?: boolean) =>
      request(servidor())
        .post('/auth/login')
        .send({
          email: EMAIL_ACTIVO,
          password: PASSWORD_PRUEBA,
          ...(mantenerSesion === undefined ? {} : { mantenerSesion }),
        })
        .expect(200);

    it('sin pedir nada, la sesión muere al cerrar el navegador', async () => {
      // El valor por omisión es el seguro. Antes del 2026-11-16 la cookie salía siempre con
      // vencimiento a 7 días, así que la sesión sobrevivía al cierre para todo el mundo.
      const res = await entrar();

      expect(muereConElNavegador(cookieCrudaDe(res, 'refresh_token'))).toBe(true);
    });

    it('marcada, la cookie lleva vencimiento', async () => {
      const res = await entrar(true);

      expect(muereConElNavegador(cookieCrudaDe(res, 'refresh_token'))).toBe(false);
    });

    it('la casilla no alarga la sesión: el token dura lo mismo en los dos casos', async () => {
      const corta = await entrar(false);
      const larga = await entrar(true);

      const vence = async (res: request.Response) => {
        const token = cookieDe(res, 'refresh_token').split('=')[1]!;
        const fila = await prisma.tokenAcceso.findUniqueOrThrow({
          where: { tokenHash: hashToken(decodeURIComponent(token)) },
        });
        return fila.expiraAt.getTime();
      };

      // Mismo TTL: lo único que cambia es si el navegador se queda con la cookie.
      expect(Math.abs((await vence(larga)) - (await vence(corta)))).toBeLessThan(5_000);
    });

    it('la elección sobrevive a la rotación del refresh', async () => {
      const login = await entrar(true);
      const refresco = await request(servidor())
        .post('/auth/refresh')
        .set('Cookie', cookieDe(login, 'refresh_token'))
        .expect(200);

      // Sin esto, la primera renovación convertiría la sesión marcada en una de turno.
      expect(muereConElNavegador(cookieCrudaDe(refresco, 'refresh_token'))).toBe(false);
    });

    it('nadie se la regala a sí mismo al refrescar: la decide el servidor', async () => {
      const login = await entrar(false);
      const refresco = await request(servidor())
        .post('/auth/refresh')
        .set('Cookie', cookieDe(login, 'refresh_token'))
        .send({ mantenerSesion: true })
        .expect(200);

      // Si viniera en la petición, cualquiera convertiría una sesión de turno en una de 7 días.
      expect(muereConElNavegador(cookieCrudaDe(refresco, 'refresh_token'))).toBe(true);
    });
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
        aceptaTerminos: true,
      })
      .expect(200);

    expect(res.body.usuario).toMatchObject({ nombre: 'Carla', apellido: 'Soto' });
    expect(cookieDe(res, 'refresh_token')).not.toBe('');
    // En la activación no se pregunta por «mantener sesión iniciada», y lo que no se pregunta
    // se resuelve por lo seguro: la sesión muere con el navegador (SPEC §3.9).
    expect(muereConElNavegador(cookieCrudaDe(res, 'refresh_token'))).toBe(true);

    // La transacción de identity dejó la cuenta activa y la aceptación del aviso registrada.
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_INVITADO },
      include: { aceptaciones: true },
    });
    expect(usuario.estado).toBe('ACTIVO');
    // Dos filas desde el 2026-11-12: el aviso y los términos se aceptan por separado.
    expect(usuario.aceptaciones).toHaveLength(2);
    expect(usuario.aceptaciones.map((a: { documento: string }) => a.documento).sort()).toEqual([
      'AVISO_PRIVACIDAD',
      'TERMINOS',
    ]);

    // Y el token no sirve una segunda vez.
    await request(servidor())
      .post('/auth/invitaciones/aceptar')
      .send({
        token: invitacionToken,
        nombre: 'Otra',
        apellido: 'Persona',
        password: 'tercera-clave-de-prueba',
        aceptaAviso: true,
        aceptaTerminos: true,
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
