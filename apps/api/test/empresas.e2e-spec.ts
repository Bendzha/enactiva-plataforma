import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { EmpresaResumen } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_OPERATIVO = 'operativo.empresas@plataforma.local';
const EMAIL_RRHH = 'rrhh.empresas@plataforma.local';
const EMAIL_ESTUDIANTE = 'estudiante.empresas@plataforma.local';
const EMAILS_PRUEBA = [EMAIL_OPERATIVO, EMAIL_RRHH, EMAIL_ESTUDIANTE];
const NOMBRE_ACTIVA = 'AAA Empresa activa (e2e)';
const NOMBRE_PENDIENTE = 'AAB Empresa en onboarding (e2e)';

describe('Listado de empresas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let empresaActivaId: string;
  let empresaPendienteId: string;
  let tokenPrincipal: string;
  let tokenOperativo: string;
  let tokenRrhh: string;

  const iniciarSesion = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
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

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const passwordHash = await hashPassword(PASSWORD_PRUEBA);

    const activa = await prisma.empresa.create({
      data: {
        nombre: NOMBRE_ACTIVA,
        rubro: 'Minería',
        estado: 'ACTIVA',
        activadaAt: new Date(),
        activadaPorId: admin.id,
        creadaPorId: admin.id,
      },
    });
    const pendiente = await prisma.empresa.create({
      data: { nombre: NOMBRE_PENDIENTE, rubro: 'Servicios TI', creadaPorId: admin.id },
    });
    empresaActivaId = activa.id;
    empresaPendienteId = pendiente.id;

    // Dos personas en la empresa activa, pero una todavía sin activar su cuenta.
    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaActivaId,
        roles: { create: { rol: 'RRHH' } },
      },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_ESTUDIANTE,
        estado: 'INVITADO',
        empresaId: empresaActivaId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_OPERATIVO,
        passwordHash,
        estado: 'ACTIVO',
        nivelAdmin: 'OPERATIVO',
        roles: { create: { rol: 'ADMIN_ENACTIVA' } },
      },
    });

    tokenPrincipal = await iniciarSesion(EMAIL_ADMIN, PASSWORD_ADMIN);
    tokenOperativo = await iniciarSesion(EMAIL_OPERATIVO, PASSWORD_PRUEBA);
    tokenRrhh = await iniciarSesion(EMAIL_RRHH, PASSWORD_PRUEBA);
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { in: EMAILS_PRUEBA } } });
    await prisma.empresa.deleteMany({ where: { id: { in: [empresaActivaId, empresaPendienteId] } } });
    await app.close();
  });

  it('el Admin Principal ve las empresas con su estado y cuántas personas activas tienen', async () => {
    const res = await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);

    const empresas = res.body as EmpresaResumen[];
    const activa = empresas.find((e) => e.id === empresaActivaId);
    const pendiente = empresas.find((e) => e.id === empresaPendienteId);

    expect(activa).toMatchObject({ nombre: NOMBRE_ACTIVA, rubro: 'Minería', estado: 'ACTIVA' });
    expect(activa!.activadaAt).not.toBeNull();
    // Solo cuenta la persona ACTIVO, no la que sigue invitada.
    expect(activa!.personasActivas).toBe(1);

    expect(pendiente).toMatchObject({ estado: 'ONBOARDING_PENDIENTE', personasActivas: 0 });
    expect(pendiente!.activadaAt).toBeNull();
  });

  it('las devuelve ordenadas por nombre', async () => {
    const res = await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);

    const nombres = (res.body as EmpresaResumen[]).map((e) => e.nombre);
    expect([...nombres].sort((a, b) => a.localeCompare(b))).toEqual(nombres);
  });

  it('el Admin Operativo también puede listarlas', async () => {
    await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .expect(200);
  });

  it('RRHH no puede listar las empresas del piloto', async () => {
    await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(403);
  });

  it('sin sesión responde 401', async () => {
    await request(app.getHttpServer()).get('/empresas').expect(401);
  });
});
