import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { MetricasGlobales, MetricasIntereses } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, tokenDe } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_RRHH = 'rrhh.metricas@plataforma.local';
const EMAIL_CAPACITADOR = 'capacitador.metricas@plataforma.local';
const EMAIL_ESTUDIANTE = 'estudiante.metricas@plataforma.local';
const EMAIL_OTRA_EMPRESA = 'rrhh.otra.metricas@plataforma.local';

describe('Métricas de intereses declarados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenRrhh: string;
  let tokenAdmin: string;
  let tokenOtraEmpresa: string;
  let tokenCapacitador: string;
  let empresaAId: string;

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(metricas e2e)' } },
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

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const passwordHash = await hashPassword(PASSWORD_PRUEBA);

    const empresaA = await prisma.empresa.create({
      data: { nombre: 'Austral Foods (metricas e2e)', rubro: 'Alimentos', creadaPorId: admin.id },
    });
    const empresaB = await prisma.empresa.create({
      data: { nombre: 'Zeta Logística (metricas e2e)', rubro: 'Transporte', creadaPorId: admin.id },
    });
    empresaAId = empresaA.id;

    const comun = { passwordHash, estado: 'ACTIVO' as const };
    const rrhh = await prisma.usuario.create({
      data: {
        ...comun,
        email: EMAIL_RRHH,
        empresaId: empresaAId,
        roles: { create: { rol: 'RRHH' } },
      },
    });
    const capacitador = await prisma.usuario.create({
      data: {
        ...comun,
        email: EMAIL_CAPACITADOR,
        empresaId: empresaAId,
        roles: { create: { rol: 'CAPACITADOR' } },
      },
    });
    const estudiante = await prisma.usuario.create({
      data: {
        ...comun,
        email: EMAIL_ESTUDIANTE,
        empresaId: empresaAId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
    await prisma.usuario.create({
      data: {
        ...comun,
        email: EMAIL_OTRA_EMPRESA,
        empresaId: empresaB.id,
        roles: { create: { rol: 'RRHH' } },
      },
    });

    const excel = await prisma.tema.create({
      data: {
        empresaId: empresaAId,
        nombre: 'Excel avanzado',
        nombreNormalizado: 'excel avanzado',
      },
    });
    const ingles = await prisma.tema.create({
      data: {
        empresaId: empresaAId,
        nombre: 'Inglés técnico',
        nombreNormalizado: 'ingles tecnico',
      },
    });
    // Un tema del catálogo que nadie declaró todavía: no debe contarse como brecha.
    await prisma.tema.create({
      data: {
        empresaId: empresaAId,
        nombre: 'Primeros auxilios',
        nombreNormalizado: 'primeros auxilios',
      },
    });

    await prisma.perfilInteres.createMany({
      data: [
        {
          empresaId: empresaAId,
          usuarioId: capacitador.id,
          temaId: excel.id,
          tipo: 'ENSENAR',
          dimensiones: ['CONTENIDO'],
          nivel: 'AVANZADO',
        },
        {
          empresaId: empresaAId,
          usuarioId: estudiante.id,
          temaId: excel.id,
          tipo: 'APRENDER',
          dimensiones: ['CONTENIDO'],
          nivel: 'BASICO',
        },
        // Dos personas quieren inglés y nadie lo enseña: ahí está la brecha.
        {
          empresaId: empresaAId,
          usuarioId: estudiante.id,
          temaId: ingles.id,
          tipo: 'APRENDER',
          dimensiones: ['HABILIDAD'],
          nivel: 'BASICO',
        },
        {
          empresaId: empresaAId,
          usuarioId: capacitador.id,
          temaId: ingles.id,
          tipo: 'APRENDER',
          dimensiones: ['HABILIDAD'],
          nivel: 'INTERMEDIO',
        },
      ],
    });

    // rrhh queda sin declarar nada a propósito: es la diferencia entre personas y perfiles.
    void rrhh;

    tokenRrhh = await tokenDe(app, EMAIL_RRHH);
    tokenCapacitador = await tokenDe(app, EMAIL_CAPACITADOR);
    tokenOtraEmpresa = await tokenDe(app, EMAIL_OTRA_EMPRESA);
    tokenAdmin = await tokenDe(app, EMAIL_ADMIN);
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('RRHH ve cuánta de su gente ya declaró sus temas', async () => {
    const res = await request(app.getHttpServer())
      .get('/metricas/intereses')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(200);

    const metricas = res.body as MetricasIntereses;
    expect(metricas).toMatchObject({
      personasActivas: 3,
      personasConPerfil: 2,
      temas: 3,
      declaraciones: 4,
    });
  });

  it('señala los temas que alguien quiere aprender y nadie puede enseñar', async () => {
    const res = await request(app.getHttpServer())
      .get('/metricas/intereses')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(200);

    const metricas = res.body as MetricasIntereses;
    expect(metricas.brechas.map((t) => t.nombre)).toEqual(['Inglés técnico']);
    expect(metricas.brechas[0]).toMatchObject({ quierenAprender: 2, puedenEnsenar: 0 });
    expect(metricas.masOfrecidos.map((t) => t.nombre)).toEqual(['Excel avanzado']);
  });

  it('las métricas de una empresa no incluyen nada de otra', async () => {
    const res = await request(app.getHttpServer())
      .get('/metricas/intereses')
      .set('Authorization', `Bearer ${tokenOtraEmpresa}`)
      .expect(200);

    expect(res.body).toMatchObject({ personasActivas: 1, declaraciones: 0, temas: 0 });
    expect((res.body as MetricasIntereses).brechas).toEqual([]);
  });

  it('quien no gestiona personas no ve las métricas de la empresa', async () => {
    await request(app.getHttpServer())
      .get('/metricas/intereses')
      .set('Authorization', `Bearer ${tokenCapacitador}`)
      .expect(403);
  });

  it('el Admin Principal ve el piloto empresa por empresa', async () => {
    const res = await request(app.getHttpServer())
      .get('/metricas/globales')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .expect(200);

    const metricas = res.body as MetricasGlobales;
    const austral = metricas.empresas.find((e) => e.empresaId === empresaAId);
    expect(austral).toMatchObject({
      personasActivas: 3,
      personasConPerfil: 2,
      temas: 3,
      declaraciones: 4,
      brechas: 1,
    });
    expect(metricas.declaraciones).toBeGreaterThanOrEqual(4);
  });

  it('RRHH no ve las métricas globales del piloto', async () => {
    await request(app.getHttpServer())
      .get('/metricas/globales')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(403);
  });
});
