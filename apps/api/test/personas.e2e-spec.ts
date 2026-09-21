import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { AreaResumen, PersonaResumen } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_RRHH_A = 'rrhh.personas.a@plataforma.local';
const EMAIL_RRHH_B = 'rrhh.personas.b@plataforma.local';
const EMAIL_NUEVA_PERSONA = 'colaborador.nuevo@plataforma.local';
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

const contarCorreos = async (email: string): Promise<number> => {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const datos = (await res.json()) as { messages?: unknown[] };
  return datos.messages?.length ?? 0;
};

describe('Personas y áreas de una empresa (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenRrhhA: string;
  let tokenRrhhB: string;
  let tokenAdmin: string;
  let empresaAId: string;
  let empresaBId: string;
  let areaOperacionesId: string;
  let areaDeOtraEmpresaId: string;

  const iniciarSesion = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  };

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(personas e2e)' } },
      select: { id: true },
    });
    const ids = empresas.map((e) => e.id);
    await prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
  };

  beforeAll(async () => {
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
    await app.init();
    prisma = app.get(PrismaService);
    await limpiar();

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const passwordHash = await hashPassword(PASSWORD_PRUEBA);

    const empresaA = await prisma.empresa.create({
      data: { nombre: 'Planta Norte (personas e2e)', rubro: 'Minería', creadaPorId: admin.id },
    });
    const empresaB = await prisma.empresa.create({
      data: { nombre: 'Grupo Andesco (personas e2e)', rubro: 'Retail', creadaPorId: admin.id },
    });
    empresaAId = empresaA.id;
    empresaBId = empresaB.id;

    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH_A,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaAId,
        roles: { create: { rol: 'RRHH' } },
      },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH_B,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaBId,
        roles: { create: { rol: 'RRHH' } },
      },
    });

    const areaDeB = await prisma.area.create({
      data: { empresaId: empresaBId, nombre: 'Finanzas', nombreNormalizado: 'finanzas' },
    });
    areaDeOtraEmpresaId = areaDeB.id;

    tokenRrhhA = await iniciarSesion(EMAIL_RRHH_A, PASSWORD_PRUEBA);
    tokenRrhhB = await iniciarSesion(EMAIL_RRHH_B, PASSWORD_PRUEBA);
    tokenAdmin = await iniciarSesion(EMAIL_ADMIN, PASSWORD_ADMIN);
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('RRHH crea un área de su empresa', async () => {
    const res = await request(app.getHttpServer())
      .post('/areas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .send({ nombre: 'Operaciones' })
      .expect(201);

    expect(res.body).toMatchObject({ nombre: 'Operaciones', personas: 0 });
    areaOperacionesId = res.body.id;
  });

  it('no deja crear dos áreas con el mismo nombre, aunque cambien tildes o mayúsculas', async () => {
    await request(app.getHttpServer())
      .post('/areas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .send({ nombre: '  operaciónes ' })
      .expect(409);
  });

  it('cada empresa ve solo sus áreas', async () => {
    const deA = await request(app.getHttpServer())
      .get('/areas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(200);
    const deB = await request(app.getHttpServer())
      .get('/areas')
      .set('Authorization', `Bearer ${tokenRrhhB}`)
      .expect(200);

    expect((deA.body as AreaResumen[]).map((a) => a.nombre)).toEqual(['Operaciones']);
    expect((deB.body as AreaResumen[]).map((a) => a.nombre)).toEqual(['Finanzas']);
  });

  it('invita a una persona con su área y sus roles, y le manda el correo', async () => {
    const res = await request(app.getHttpServer())
      .post('/personas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .send({
        email: EMAIL_NUEVA_PERSONA.toUpperCase(),
        roles: ['ESTUDIANTE', 'CAPACITADOR'],
        areaId: areaOperacionesId,
        cargo: 'Analista de Procesos',
      })
      .expect(201);

    const persona = res.body as PersonaResumen;
    expect(persona).toMatchObject({
      email: EMAIL_NUEVA_PERSONA,
      estado: 'INVITADO',
      areaNombre: 'Operaciones',
      cargo: 'Analista de Procesos',
    });
    expect(persona.roles.sort()).toEqual(['CAPACITADOR', 'ESTUDIANTE']);
    expect(await contarCorreos(EMAIL_NUEVA_PERSONA)).toBe(1);
  });

  it('no permite asignar un área de otra empresa', async () => {
    const res = await request(app.getHttpServer())
      .post('/personas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .send({
        email: 'otro.colaborador@plataforma.local',
        roles: ['ESTUDIANTE'],
        areaId: areaDeOtraEmpresaId,
      })
      .expect(400);

    expect(res.body.message).toMatch(/no existe en tu empresa/i);
  });

  it('rechaza roles que RRHH no puede asignar, como el de administrador', async () => {
    await request(app.getHttpServer())
      .post('/personas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .send({ email: 'intruso@plataforma.local', roles: ['ADMIN_ENACTIVA'] })
      .expect(400);
  });

  it('la lista de personas queda acotada a la propia empresa', async () => {
    const deA = await request(app.getHttpServer())
      .get('/personas')
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(200);

    const emails = (deA.body as PersonaResumen[]).map((p) => p.email);
    expect(emails).toContain(EMAIL_RRHH_A);
    expect(emails).toContain(EMAIL_NUEVA_PERSONA);
    expect(emails).not.toContain(EMAIL_RRHH_B);
    expect(emails).not.toContain(EMAIL_ADMIN);
  });

  it('reenviar la invitación emite un token nuevo y revoca el anterior', async () => {
    const persona = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_NUEVA_PERSONA },
    });

    await request(app.getHttpServer())
      .post(`/personas/${persona.id}/invitacion/reenviar`)
      .set('Authorization', `Bearer ${tokenRrhhA}`)
      .expect(201);

    const tokens = await prisma.tokenAcceso.findMany({
      where: { usuarioId: persona.id, tipo: 'INVITACION' },
      orderBy: { createdAt: 'asc' },
    });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]!.revocadoAt).not.toBeNull();
    expect(tokens[1]!.revocadoAt).toBeNull();
    expect(await contarCorreos(EMAIL_NUEVA_PERSONA)).toBe(2);
  });

  it('RRHH de otra empresa no puede tocar a esa persona', async () => {
    const persona = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_NUEVA_PERSONA },
    });

    await request(app.getHttpServer())
      .post(`/personas/${persona.id}/invitacion/reenviar`)
      .set('Authorization', `Bearer ${tokenRrhhB}`)
      .expect(404);
  });

  it('el equipo de ENACTIVA no administra la gente de las empresas', async () => {
    await request(app.getHttpServer())
      .get('/personas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/areas')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(403);
  });
});
