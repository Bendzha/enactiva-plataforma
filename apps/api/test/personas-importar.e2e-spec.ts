import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ResultadoImportacion, VistaPreviaImportacion } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_RRHH = 'rrhh.importar@plataforma.local';
const MAILPIT = process.env.MAILPIT_API_URL ?? 'http://localhost:8025';

// Una fila con coma dentro de comillas, una repetida, un email malo y un rol inexistente.
const CSV = [
  'email,roles,area,cargo',
  'ana.perez@planta.cl,ESTUDIANTE,Operaciones,"Analista, turno A"',
  'luis.soto@planta.cl,estudiante|capacitador,Operaciones,Supervisor',
  'carla.diaz@planta.cl,,Calidad,',
  'ana.perez@planta.cl,ESTUDIANTE,Operaciones,',
  'esto-no-es-email,ESTUDIANTE,Operaciones,',
  'pedro.rojas@planta.cl,GERENTE,Operaciones,',
].join('\n');

describe('Carga masiva de colaboradores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let empresaId: string;

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(importar e2e)' } },
      select: { id: true },
    });
    const ids = empresas.map((e) => e.id);
    await prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.area.deleteMany({ where: { empresaId: { in: ids } } });
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
    const empresa = await prisma.empresa.create({
      data: { nombre: 'Planta Norte (importar e2e)', rubro: 'Minería', creadaPorId: admin.id },
    });
    empresaId = empresa.id;

    await prisma.area.create({
      data: { empresaId, nombre: 'Operaciones', nombreNormalizado: 'operaciones' },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH,
        passwordHash: await hashPassword(PASSWORD_PRUEBA),
        estado: 'ACTIVO',
        empresaId,
        roles: { create: { rol: 'RRHH' } },
      },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL_RRHH, password: PASSWORD_PRUEBA })
      .expect(200);
    token = login.body.accessToken;
    await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('la vista previa explica fila por fila qué pasará, sin escribir nada', async () => {
    const res = await request(app.getHttpServer())
      .post('/personas/importar/vista-previa')
      .set('Authorization', `Bearer ${token}`)
      .send({ contenido: CSV })
      .expect(200);

    const vista = res.body as VistaPreviaImportacion;
    expect(vista.validas).toBe(3);
    expect(vista.conError).toBe(3);

    // ana.perez aparece dos veces a propósito: se busca su primera aparición.
    const primera = (email: string) => vista.filas.find((f) => f.email === email)!;
    expect(primera('ana.perez@planta.cl').cargo).toBe('Analista, turno A');
    expect(primera('luis.soto@planta.cl').roles).toEqual(['ESTUDIANTE', 'CAPACITADOR']);
    // Sin columna de roles se asume Estudiante, y Calidad es un área nueva.
    expect(primera('carla.diaz@planta.cl').roles).toEqual(['ESTUDIANTE']);
    expect(primera('carla.diaz@planta.cl').areaNueva).toBe(true);
    expect(primera('esto-no-es-email').error).toMatch(/inválido/i);
    expect(primera('pedro.rojas@planta.cl').error).toMatch(/Rol desconocido/i);
    // La segunda aparición del mismo correo es la que queda marcada.
    expect(vista.filas.filter((f) => f.error === 'Email repetido en el archivo')).toHaveLength(1);

    expect(await prisma.usuario.count({ where: { empresaId } })).toBe(1); // solo RRHH
  });

  it('importa solo las filas válidas y crea las áreas que faltaban', async () => {
    const res = await request(app.getHttpServer())
      .post('/personas/importar')
      .set('Authorization', `Bearer ${token}`)
      .send({ contenido: CSV })
      .expect(201);

    const resultado = res.body as ResultadoImportacion;
    expect(resultado.invitadas).toBe(3);
    expect(resultado.conError).toBe(3);
    expect(resultado.areasCreadas).toEqual(['Calidad']);

    const personas = await prisma.usuario.findMany({
      where: { empresaId, estado: 'INVITADO' },
      include: { roles: true, area: true },
    });
    expect(personas).toHaveLength(3);

    const luis = personas.find((p) => p.email === 'luis.soto@planta.cl')!;
    expect(luis.roles.map((r) => r.rol).sort()).toEqual(['CAPACITADOR', 'ESTUDIANTE']);
    expect(luis.area!.nombre).toBe('Operaciones');
    expect(luis.cargo).toBe('Supervisor');

    const carla = personas.find((p) => p.email === 'carla.diaz@planta.cl')!;
    expect(carla.area!.nombre).toBe('Calidad');
  });

  it('cada persona importada recibe su correo de invitación', async () => {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:luis.soto@planta.cl')}`,
    );
    const { messages } = (await res.json()) as { messages: { Subject: string }[] };

    expect(messages).toHaveLength(1);
    expect(messages[0]!.Subject).toContain('Planta Norte (importar e2e)');
  });

  it('al reimportar el mismo archivo no duplica a nadie', async () => {
    const res = await request(app.getHttpServer())
      .post('/personas/importar')
      .set('Authorization', `Bearer ${token}`)
      .send({ contenido: CSV })
      .expect(201);

    expect((res.body as ResultadoImportacion).invitadas).toBe(0);
    expect(await prisma.usuario.count({ where: { empresaId } })).toBe(4); // RRHH + 3
  });

  it('rechaza un archivo vacío o sin filas de datos', async () => {
    await request(app.getHttpServer())
      .post('/personas/importar/vista-previa')
      .set('Authorization', `Bearer ${token}`)
      .send({ contenido: 'email,roles' })
      .expect(400);
  });
});
