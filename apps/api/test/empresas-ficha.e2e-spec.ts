import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { EmpresaDetalle } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_OPERATIVO = 'operativo.ficha@plataforma.local';
const EMAIL_CONTACTO = 'contacto.ficha@plataforma.local';
const NOMBRE_EMPRESA = 'Manufacturas Aconcagua (ficha e2e)';
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

const contarCorreos = async (email: string): Promise<number> => {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const datos = (await res.json()) as { messages?: unknown[] };
  return datos.messages?.length ?? 0;
};

describe('Ficha, activación y reenvío de invitación (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenPrincipal: string;
  let tokenOperativo: string;
  let empresaId: string;
  let contactoId: string;

  const iniciarSesion = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  };

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(ficha e2e)' } },
      select: { id: true },
    });
    const ids = empresas.map((e) => e.id);
    await prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { email: EMAIL_OPERATIVO } });
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

    await prisma.usuario.create({
      data: {
        email: EMAIL_OPERATIVO,
        passwordHash: await hashPassword(PASSWORD_PRUEBA),
        estado: 'ACTIVO',
        nivelAdmin: 'OPERATIVO',
        roles: { create: { rol: 'ADMIN_ENACTIVA' } },
      },
    });

    tokenPrincipal = await iniciarSesion(EMAIL_ADMIN, PASSWORD_ADMIN);
    tokenOperativo = await iniciarSesion(EMAIL_OPERATIVO, PASSWORD_PRUEBA);

    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });

    const creada = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ nombre: NOMBRE_EMPRESA, rubro: 'Manufactura', emailRrhh: EMAIL_CONTACTO })
      .expect(201);
    empresaId = (creada.body as EmpresaDetalle).id;
    contactoId = (creada.body as EmpresaDetalle).contactoRrhh!.id;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('la ficha muestra la empresa y el estado de la invitación de RRHH', async () => {
    const res = await request(app.getHttpServer())
      .get(`/empresas/${empresaId}`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);

    const empresa = res.body as EmpresaDetalle;
    expect(empresa).toMatchObject({ nombre: NOMBRE_EMPRESA, estado: 'ONBOARDING_PENDIENTE' });
    expect(empresa.contactoRrhh).toMatchObject({ email: EMAIL_CONTACTO, estado: 'INVITADO' });
    expect(empresa.contactoRrhh!.invitacionExpiraAt).not.toBeNull();
  });

  it('una empresa que no existe responde 404, y un id mal formado 400', async () => {
    await request(app.getHttpServer())
      .get('/empresas/01a0a575-0000-7000-8000-000000000000')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(404);

    await request(app.getHttpServer())
      .get('/empresas/no-es-un-id')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(400);
  });

  it('el Admin Operativo NO puede activar la empresa', async () => {
    await request(app.getHttpServer())
      .patch(`/empresas/${empresaId}/activar`)
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .expect(403);

    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    expect(empresa.estado).toBe('ONBOARDING_PENDIENTE');
  });

  it('el Admin Principal la activa y queda registrado quién y cuándo', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/empresas/${empresaId}/activar`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(200);

    expect(res.body.estado).toBe('ACTIVA');
    expect(res.body.activadaAt).not.toBeNull();

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const empresa = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaId } });
    expect(empresa.activadaPorId).toBe(admin.id);

    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: 'ACTUALIZAR', entidad: 'Empresa', entidadId: empresaId },
    });
    expect(registro?.camposModificados).toContain('estado');
  });

  it('activarla de nuevo responde 409', async () => {
    await request(app.getHttpServer())
      .patch(`/empresas/${empresaId}/activar`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(409);
  });

  it('reenviar la invitación emite un token nuevo, revoca el anterior y manda otro correo', async () => {
    const antes = await prisma.tokenAcceso.findMany({
      where: { usuarioId: contactoId, tipo: 'INVITACION' },
    });
    expect(antes).toHaveLength(1);

    await request(app.getHttpServer())
      .post(`/empresas/${empresaId}/invitacion/reenviar`)
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .expect(201);

    const despues = await prisma.tokenAcceso.findMany({
      where: { usuarioId: contactoId, tipo: 'INVITACION' },
      orderBy: { createdAt: 'asc' },
    });
    expect(despues).toHaveLength(2);
    expect(despues[0]!.revocadoAt).not.toBeNull();
    expect(despues[1]!.revocadoAt).toBeNull();
    expect(despues[1]!.tokenHash).not.toBe(despues[0]!.tokenHash);

    expect(await contarCorreos(EMAIL_CONTACTO)).toBe(2);
  });

  it('no se puede reenviar la invitación a alguien que ya activó su cuenta', async () => {
    await prisma.usuario.update({ where: { id: contactoId }, data: { estado: 'ACTIVO' } });

    await request(app.getHttpServer())
      .post(`/empresas/${empresaId}/invitacion/reenviar`)
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .expect(409);

    await prisma.usuario.update({ where: { id: contactoId }, data: { estado: 'INVITADO' } });
  });
});
