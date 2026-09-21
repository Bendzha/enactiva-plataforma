import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { EmpresaDetalle } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { hashToken } from '../src/common/tokens.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { serializar } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_OPERATIVO = 'operativo.crear@plataforma.local';
const EMAIL_RRHH_EXISTENTE = 'rrhh.existente@plataforma.local';
const EMAIL_NUEVO_RRHH = 'contacto.nuevo@plataforma.local';
const EMAIL_SEGUNDO_RRHH = 'contacto.segundo@plataforma.local';
const NOMBRE_EMPRESA = 'Comercial Rioclaro (e2e)';
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

interface MensajeMailpit {
  ID: string;
  Subject: string;
}

const vaciarBandeja = () => fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });

const buscarCorreo = async (email: string): Promise<MensajeMailpit[]> => {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const datos = (await res.json()) as { messages?: MensajeMailpit[] };
  return datos.messages ?? [];
};

const cuerpoDelCorreo = async (id: string): Promise<string> => {
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const datos = (await res.json()) as { HTML?: string; Text?: string };
  return `${datos.HTML ?? ''}${datos.Text ?? ''}`;
};

describe('Alta de empresa con invitación a RRHH (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenPrincipal: string;
  let tokenOperativo: string;
  let tokenRrhh: string;
  let empresaExistenteId: string;

  const iniciarSesion = async (email: string, password: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken;
  };

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(e2e)' } },
      select: { id: true },
    });
    const ids = empresas.map((e) => e.id);
    await prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
    await prisma.usuario.deleteMany({
      where: { email: { in: [EMAIL_OPERATIVO, EMAIL_NUEVO_RRHH, EMAIL_SEGUNDO_RRHH] } },
    });
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

    const existente = await prisma.empresa.create({
      data: { nombre: 'Empresa con contacto tomado (e2e)', rubro: 'Retail', creadaPorId: admin.id },
    });
    empresaExistenteId = existente.id;

    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH_EXISTENTE,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaExistenteId,
        roles: { create: { rol: 'RRHH' } },
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
    tokenRrhh = await iniciarSesion(EMAIL_RRHH_EXISTENTE, PASSWORD_PRUEBA);
    await vaciarBandeja();
  });

  afterAll(async () => {
    await limpiar();
    await prisma.usuario.deleteMany({ where: { email: EMAIL_RRHH_EXISTENTE } });
    await app.close();
  });

  it('crea la empresa en onboarding y deja al contacto de RRHH invitado', async () => {
    const res = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ nombre: NOMBRE_EMPRESA, rubro: 'Retail', emailRrhh: EMAIL_NUEVO_RRHH.toUpperCase() })
      .expect(201);

    const empresa = res.body as EmpresaDetalle;
    expect(empresa).toMatchObject({
      nombre: NOMBRE_EMPRESA,
      rubro: 'Retail',
      estado: 'ONBOARDING_PENDIENTE',
      activadaAt: null,
      personasActivas: 0,
    });
    // El email se guarda normalizado en minúsculas.
    expect(empresa.contactoRrhh).toMatchObject({ email: EMAIL_NUEVO_RRHH, estado: 'INVITADO' });
    expect(empresa.contactoRrhh!.invitacionExpiraAt).not.toBeNull();

    const contacto = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_NUEVO_RRHH },
      include: { roles: true, tokens: true },
    });
    expect(contacto.roles.map((r) => r.rol)).toEqual(['RRHH']);
    expect(contacto.passwordHash).toBeNull();
    expect(contacto.tokens).toHaveLength(1);
    expect(contacto.tokens[0]!.tipo).toBe('INVITACION');
  });

  it('envía el correo de invitación con un enlace de activación válido', async () => {
    const mensajes = await buscarCorreo(EMAIL_NUEVO_RRHH);
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]!.Subject).toContain(NOMBRE_EMPRESA);

    const cuerpo = await cuerpoDelCorreo(mensajes[0]!.ID);
    const enlace = /\/activar\?token=([A-Za-z0-9_-]+)/.exec(cuerpo);
    expect(enlace).not.toBeNull();

    // El token del correo debe corresponder al hash guardado: nunca se guarda en claro.
    const contacto = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_NUEVO_RRHH },
      include: { tokens: true },
    });
    expect(contacto.tokens[0]!.tokenHash).toBe(hashToken(enlace![1]!));
    expect(cuerpo).not.toContain(contacto.tokens[0]!.tokenHash);
  });

  it('deja los dos registros en la auditoría, sin datos personales', async () => {
    const empresa = await prisma.empresa.findFirstOrThrow({ where: { nombre: NOMBRE_EMPRESA } });
    const registros = await prisma.registroAuditoria.findMany({
      where: { empresaId: empresa.id, accion: 'CREAR' },
    });

    expect(registros.map((r) => r.entidad).sort()).toEqual(['Empresa', 'Usuario']);
    expect(registros.every((r) => r.actorRol === 'ADMIN_ENACTIVA')).toBe(true);
    expect(serializar(registros)).not.toContain(EMAIL_NUEVO_RRHH);
  });

  it('rechaza con 409 si el email de RRHH ya tiene cuenta', async () => {
    const res = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ nombre: 'Otra empresa (e2e)', rubro: 'Salud', emailRrhh: EMAIL_RRHH_EXISTENTE })
      .expect(409);

    expect(res.body.message).toMatch(/ya existe/i);
  });

  it('rechaza con 400 los datos incompletos y dice qué campo falla', async () => {
    const res = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${tokenPrincipal}`)
      .send({ nombre: 'A', rubro: '', emailRrhh: 'sin-arroba' })
      .expect(400);

    const campos = (res.body.errores as { campo: string }[]).map((e) => e.campo);
    expect(campos).toEqual(expect.arrayContaining(['nombre', 'rubro', 'emailRrhh']));
  });

  it('el Admin Operativo también puede dar de alta empresas', async () => {
    await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${tokenOperativo}`)
      .send({
        nombre: 'Empresa del operativo (e2e)',
        rubro: 'Manufactura',
        emailRrhh: EMAIL_SEGUNDO_RRHH,
      })
      .expect(201);
  });

  it('RRHH no puede dar de alta empresas', async () => {
    await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({
        nombre: 'Empresa prohibida (e2e)',
        rubro: 'Retail',
        emailRrhh: 'otro@plataforma.local',
      })
      .expect(403);
  });
});
