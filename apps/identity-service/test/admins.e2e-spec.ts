import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { CABECERA_INTERNO, type AdminResumen } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, tokenDe } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_OPERATIVO = 'operativo.equipo@plataforma.local';
const EMAIL_INVITADO = 'nuevo.admin@plataforma.local';
const EMAILS_PRUEBA = [EMAIL_OPERATIVO, EMAIL_INVITADO];
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

const contarCorreos = async (email: string): Promise<number> => {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const datos = (await res.json()) as { messages?: unknown[] };
  return datos.messages?.length ?? 0;
};

describe('Equipo de ENACTIVA (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenPrincipal: string;
  let tokenOperativo: string;
  let operativoId: string;
  let adminPrincipalId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.usuario.deleteMany({ where: { email: { in: EMAILS_PRUEBA } } });

    const operativo = await prisma.usuario.create({
      data: {
        email: EMAIL_OPERATIVO,
        passwordHash: await hashPassword(PASSWORD_PRUEBA),
        estado: 'ACTIVO',
        nivelAdmin: 'OPERATIVO',
        roles: { create: { rol: 'ADMIN_ENACTIVA' } },
      },
    });
    operativoId = operativo.id;
    adminPrincipalId = (await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } }))
      .id;

    tokenPrincipal = await tokenDe(app, EMAIL_ADMIN);
    tokenOperativo = await tokenDe(app, EMAIL_OPERATIVO);
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { in: EMAILS_PRUEBA } } });
    await app.close();
  });

  it('el Admin Principal ve al equipo con su nivel y estado', async () => {
    const res = await request(app.getHttpServer())
      .get('/admins')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);

    const admins = res.body as AdminResumen[];
    expect(admins.find((a) => a.email === EMAIL_ADMIN)).toMatchObject({
      nivelAdmin: 'PRINCIPAL',
      estado: 'ACTIVO',
    });
    expect(admins.find((a) => a.email === EMAIL_OPERATIVO)).toMatchObject({
      nivelAdmin: 'OPERATIVO',
    });
  });

  it('el Admin Operativo no puede ver ni gestionar el equipo', async () => {
    await request(app.getHttpServer())
      .get('/admins')
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/admins')
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .send({ email: 'intruso@plataforma.local', nivelAdmin: 'OPERATIVO' })
      .expect(403);
  });

  it('invita a alguien del equipo y le envía el correo de activación', async () => {
    const res = await request(app.getHttpServer())
      .post('/admins')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ email: EMAIL_INVITADO.toUpperCase(), nivelAdmin: 'OPERATIVO' })
      .expect(201);

    expect(res.body).toMatchObject({
      email: EMAIL_INVITADO,
      nivelAdmin: 'OPERATIVO',
      estado: 'INVITADO',
    });
    expect(res.body.invitacionExpiraAt).not.toBeNull();
    expect(await contarCorreos(EMAIL_INVITADO)).toBe(1);

    const invitado = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_INVITADO },
      include: { roles: true, tokens: true },
    });
    expect(invitado.roles.map((r) => r.rol)).toEqual(['ADMIN_ENACTIVA']);
    expect(invitado.empresaId).toBeNull();
    expect(invitado.tokens[0]!.tipo).toBe('INVITACION');
  });

  it('rechaza invitar a un email que ya tiene cuenta', async () => {
    await request(app.getHttpServer())
      .post('/admins')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ email: EMAIL_OPERATIVO, nivelAdmin: 'OPERATIVO' })
      .expect(409);
  });

  it('no permite desactivar la propia cuenta', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/admins/${adminPrincipalId}/desactivar`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(409);

    expect(res.body.message).toMatch(/tu propia cuenta/i);
  });

  it('desactiva a un admin, le corta las sesiones y le impide volver a entrar', async () => {
    await request(app.getHttpServer())
      .patch(`/admins/${operativoId}/desactivar`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);

    const desactivado = await prisma.usuario.findUniqueOrThrow({
      where: { id: operativoId },
      include: { tokens: true },
    });
    expect(desactivado.estado).toBe('SUSPENDIDO');
    expect(desactivado.tokens.every((t) => t.revocadoAt !== null)).toBe(true);

    // Su sesión abierta deja de servir de inmediato, sin esperar a que venza el token.
    // El guard relee el estado en cada petición dentro de este servicio; en los demás, la caché
    // de 30 s hace que el corte tarde a lo más ese tiempo (ADR-0007, decisión D2).
    await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .expect(401);

    // Y tampoco puede volver a entrar: lo comprueba el endpoint interno que usa auth-service.
    await request(app.getHttpServer())
      .post('/interno/sesiones/login')
      .set(CABECERA_INTERNO, process.env.INTERNO_SECRETO!)
      .send({ email: EMAIL_OPERATIVO, password: PASSWORD_PRUEBA })
      .expect(401);
  });

  it('desactivar dos veces responde 409', async () => {
    await request(app.getHttpServer())
      .patch(`/admins/${operativoId}/desactivar`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(409);
  });
});
