import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const EMAIL_SUSPENDIDO = 'suspendido.e2e@plataforma.local';
const PASSWORD_SUSPENDIDO = 'clave-de-prueba-larga';

// El límite de intentos se prueba aparte, en auth-throttling.e2e-spec.ts.
describe('Autenticación (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const cookieRefresh = (res: request.Response): string => {
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
    return cookies?.find((c) => c.startsWith('refresh_token=')) ?? '';
  };

  beforeAll(async () => {
    // Almacenamiento de throttling que nunca bloquea: el límite se prueba en su propio archivo.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue({
        increment: async () => ({
          totalHits: 1,
          timeToExpire: 60,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.usuario.upsert({
      where: { email: EMAIL_SUSPENDIDO },
      update: { estado: 'SUSPENDIDO' },
      create: {
        email: EMAIL_SUSPENDIDO,
        passwordHash: await hashPassword(PASSWORD_SUSPENDIDO),
        estado: 'SUSPENDIDO',
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: EMAIL_SUSPENDIDO } });
    await app.close();
  });

  it('con credenciales correctas devuelve token, datos de sesión y cookie de refresh', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_ADMIN.toUpperCase(), password: PASSWORD_ADMIN })
      .expect(200);

    expect(res.body.accessToken.split('.')).toHaveLength(3);
    expect(res.body.usuario).toMatchObject({
      email: EMAIL_ADMIN,
      nivelAdmin: 'PRINCIPAL',
      empresaId: null,
    });
    expect(res.body.usuario.roles).toContain('ADMIN_ENACTIVA');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const cookie = cookieRefresh(res);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/auth');
  });

  it('deja el ingreso registrado en la auditoría', async () => {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: 'LOGIN', actorId: admin.id },
      orderBy: { createdAt: 'desc' },
    });

    expect(registro).not.toBeNull();
    expect(Date.now() - registro!.createdAt.getTime()).toBeLessThan(60_000);
  });

  it('con contraseña incorrecta responde 401 y lo audita como intento fallido', async () => {
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const antes = await prisma.registroAuditoria.count({
      where: { accion: 'LOGIN_FALLIDO', actorId: admin.id },
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_ADMIN, password: 'contraseña-equivocada' })
      .expect(401);

    const despues = await prisma.registroAuditoria.count({
      where: { accion: 'LOGIN_FALLIDO', actorId: admin.id },
    });
    expect(despues).toBe(antes + 1);
  });

  it('con un email que no existe responde 401 igual que con contraseña incorrecta', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nadie@plataforma.local', password: 'lo-que-sea-largo' })
      .expect(401);

    expect(JSON.stringify(res.body)).not.toMatch(/no existe|no encontrado/i);
  });

  it('rechaza con 400 un email mal formado, antes de tocar la base', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'sin-arroba', password: 'lo-que-sea' })
      .expect(400);

    expect(res.body.mensaje).toBe('Datos inválidos');
  });

  it('no deja entrar a un usuario que no está ACTIVO', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_SUSPENDIDO, password: PASSWORD_SUSPENDIDO })
      .expect(401);
  });

  it('rota el refresh: entrega uno nuevo y el anterior deja de servir', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_ADMIN, password: PASSWORD_ADMIN })
      .expect(200);
    const cookieInicial = cookieRefresh(login);

    const refresco = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieInicial)
      .expect(200);

    expect(refresco.body.accessToken.split('.')).toHaveLength(3);
    expect(cookieRefresh(refresco)).not.toBe(cookieInicial);

    // Reusar el token viejo se trata como robo: se rechaza y se cierran las sesiones abiertas.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieInicial)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieRefresh(refresco))
      .expect(401);
  });

  it('sin cookie de refresh responde 401', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });

  it('al cerrar sesión borra la cookie y el refresh queda inutilizable', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_ADMIN, password: PASSWORD_ADMIN })
      .expect(200);
    const cookie = cookieRefresh(login);

    const salida = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);
    expect(cookieRefresh(salida)).toContain('refresh_token=;');

    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('guarda el refresh token hasheado, nunca en claro', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_ADMIN, password: PASSWORD_ADMIN })
      .expect(200);

    const valor = cookieRefresh(login).split(';')[0]!.replace('refresh_token=', '');
    const guardado = await prisma.tokenAcceso.findFirst({ where: { tokenHash: valor } });

    expect(valor.length).toBeGreaterThan(20);
    expect(guardado).toBeNull();
  });
});
