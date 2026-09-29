import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { AVISO_PRIVACIDAD_VERSION, type EmpresaDetalle } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, tokenDe } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const EMAIL_CONTACTO = 'contacto.activacion@plataforma.local';
const NOMBRE_EMPRESA = 'Grupo Andesco (activacion e2e)';
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

/**
 * Lo que identity-service aporta al flujo de activación: la invitación sale por correo y el
 * enlace permite saber qué cuenta se está activando.
 *
 * Completar la activación vive en auth-service, porque termina en una sesión iniciada
 * (ADR-0007); su test está en `apps/auth-service/test/auth.e2e-spec.ts`.
 */
describe('Invitación por correo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;

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
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await limpiar();
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });

    const empresa = await request(app.getHttpServer())
      .post('/empresas')
      .set('Authorization', `Bearer ${await tokenDe(app, EMAIL_ADMIN)}`)
      .send({ nombre: NOMBRE_EMPRESA, rubro: 'Retail', emailRrhh: EMAIL_CONTACTO })
      .expect(201);

    expect((empresa.body as EmpresaDetalle).contactoRrhh!.email).toBe(EMAIL_CONTACTO);
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

  it('sin token responde 400', async () => {
    await request(app.getHttpServer()).get('/invitaciones/estado').expect(400);
  });

  it('el estado de la invitación es público: no exige sesión', async () => {
    await request(app.getHttpServer()).get('/invitaciones/estado').query({ token }).expect(200);
  });
});
