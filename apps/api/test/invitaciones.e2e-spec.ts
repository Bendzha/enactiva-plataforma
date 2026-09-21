import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AVISO_PRIVACIDAD_VERSION, type EmpresaDetalle } from '@enactiva/shared';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_ADMIN = process.env.SEED_ADMIN_PASSWORD!;
const EMAIL_CONTACTO = 'contacto.activacion@plataforma.local';
const NOMBRE_EMPRESA = 'Grupo Andesco (activacion e2e)';
const PASSWORD_NUEVA = 'mi-clave-nueva-2026';
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

const tokenDesdeElCorreo = async (email: string): Promise<string> => {
  const busqueda = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
  );
  const { messages } = (await busqueda.json()) as { messages: { ID: string }[] };
  const mensaje = await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`);
  const { HTML, Text } = (await mensaje.json()) as { HTML?: string; Text?: string };
  const enlace = /\/activar\?token=([A-Za-z0-9_-]+)/.exec(`${HTML ?? ''}${Text ?? ''}`);
  return enlace![1]!;
};

describe('Activación de cuenta por invitación (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let contactoId: string;

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(activacion e2e)' } },
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
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    await limpiar();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_ADMIN, password: PASSWORD_ADMIN })
      .expect(200);

    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });

    const empresa = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ nombre: NOMBRE_EMPRESA, rubro: 'Retail', emailRrhh: EMAIL_CONTACTO })
      .expect(201);

    contactoId = (empresa.body as EmpresaDetalle).contactoRrhh!.id;
    token = await tokenDesdeElCorreo(EMAIL_CONTACTO);
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('el enlace del correo muestra qué cuenta se está activando', async () => {
    const res = await request(app.getHttpServer())
      .get('/invitaciones/estado')
      .query({ token })
      .expect(200);

    expect(res.body).toEqual({
      email: EMAIL_CONTACTO,
      nombreEmpresa: NOMBRE_EMPRESA,
      versionAviso: AVISO_PRIVACIDAD_VERSION,
    });
  });

  it('un token inventado responde 410 sin revelar si existió', async () => {
    const res = await request(app.getHttpServer())
      .get('/invitaciones/estado')
      .query({ token: 'token-inventado-que-no-existe-000' })
      .expect(410);

    expect(res.body.message).toMatch(/ya no es válida/i);
  });

  it('exige aceptar el aviso de privacidad y una contraseña de largo suficiente', async () => {
    const sinAviso = await request(app.getHttpServer())
      .post('/invitaciones/aceptar')
      .send({
        token,
        nombre: 'Marcela',
        apellido: 'Ruiz',
        password: PASSWORD_NUEVA,
        aceptaAviso: false,
      })
      .expect(400);
    expect(JSON.stringify(sinAviso.body)).toMatch(/aviso de privacidad/i);

    const claveCorta = await request(app.getHttpServer())
      .post('/invitaciones/aceptar')
      .send({ token, nombre: 'Marcela', apellido: 'Ruiz', password: 'corta', aceptaAviso: true })
      .expect(400);
    expect(JSON.stringify(claveCorta.body)).toMatch(/12 caracteres/);
  });

  it('activa la cuenta, registra la aceptación del aviso y deja la sesión iniciada', async () => {
    const res = await request(app.getHttpServer())
      .post('/invitaciones/aceptar')
      .send({
        token,
        nombre: 'Marcela',
        apellido: 'Ruiz',
        password: PASSWORD_NUEVA,
        aceptaAviso: true,
      })
      .expect(200);

    expect(res.body.usuario).toMatchObject({ email: EMAIL_CONTACTO, nombre: 'Marcela' });
    expect(res.body.usuario.roles).toEqual(['RRHH']);
    expect(res.body.accessToken.split('.')).toHaveLength(3);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);

    const contacto = await prisma.usuario.findUniqueOrThrow({
      where: { id: contactoId },
      include: { aceptaciones: true, tokens: true },
    });
    expect(contacto.estado).toBe('ACTIVO');
    expect(contacto.passwordHash).not.toBeNull();
    expect(contacto.aceptaciones).toHaveLength(1);
    expect(contacto.aceptaciones[0]!.versionAviso).toBe(AVISO_PRIVACIDAD_VERSION);
    // La invitación queda marcada como usada.
    expect(contacto.tokens.find((t) => t.tipo === 'INVITACION')!.usadoAt).not.toBeNull();
  });

  it('el mismo enlace no sirve dos veces', async () => {
    await request(app.getHttpServer())
      .post('/invitaciones/aceptar')
      .send({
        token,
        nombre: 'Otra',
        apellido: 'Persona',
        password: PASSWORD_NUEVA,
        aceptaAviso: true,
      })
      .expect(410);
  });

  it('con su contraseña nueva puede iniciar sesión normalmente', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_CONTACTO, password: PASSWORD_NUEVA })
      .expect(200);

    expect(res.body.usuario.empresaId).not.toBeNull();
  });
});
