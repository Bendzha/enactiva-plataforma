import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { InteresDeclarado, MiPerfil, TemaResumen } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, tokenDe } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_RRHH = 'rrhh.perfiles@plataforma.local';
const EMAIL_CAPACITADOR = 'capacitador.perfiles@plataforma.local';
const EMAIL_ESTUDIANTE = 'estudiante.perfiles@plataforma.local';
const EMAIL_OTRA_EMPRESA = 'capacitador.otra.perfiles@plataforma.local';

describe('Temas y perfiles corporativos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenRrhh: string;
  let tokenCapacitador: string;
  let tokenEstudiante: string;
  let tokenOtraEmpresa: string;
  let tokenAdmin: string;
  let empresaAId: string;
  let empresaBId: string;
  let temaExcelId: string;

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(perfiles e2e)' } },
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
      data: { nombre: 'Planta Sur (perfiles e2e)', rubro: 'Minería', creadaPorId: admin.id },
    });
    const empresaB = await prisma.empresa.create({
      data: { nombre: 'Comercial Lin (perfiles e2e)', rubro: 'Retail', creadaPorId: admin.id },
    });
    empresaAId = empresaA.id;
    empresaBId = empresaB.id;

    const area = await prisma.area.create({
      data: { empresaId: empresaAId, nombre: 'Operaciones', nombreNormalizado: 'operaciones' },
    });

    await prisma.usuario.create({
      data: {
        email: EMAIL_RRHH,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaAId,
        roles: { create: { rol: 'RRHH' } },
      },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_CAPACITADOR,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaAId,
        areaId: area.id,
        nombre: 'Luis',
        apellido: 'Soto',
        cargo: 'Supervisor',
        roles: { create: [{ rol: 'CAPACITADOR' }, { rol: 'ESTUDIANTE' }] },
      },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_ESTUDIANTE,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaAId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
    await prisma.usuario.create({
      data: {
        email: EMAIL_OTRA_EMPRESA,
        passwordHash,
        estado: 'ACTIVO',
        empresaId: empresaBId,
        roles: { create: { rol: 'CAPACITADOR' } },
      },
    });

    tokenRrhh = await tokenDe(app, EMAIL_RRHH);
    tokenCapacitador = await tokenDe(app, EMAIL_CAPACITADOR);
    tokenEstudiante = await tokenDe(app, EMAIL_ESTUDIANTE);
    tokenOtraEmpresa = await tokenDe(app, EMAIL_OTRA_EMPRESA);
    tokenAdmin = await tokenDe(app, EMAIL_ADMIN);
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('catálogo de temas', () => {
    it('RRHH agrega un tema al catálogo de su empresa', async () => {
      const res = await request(app.getHttpServer())
        .post('/temas')
        .set('Authorization', `Bearer ${tokenRrhh}`)
        .send({ nombre: 'Excel avanzado' })
        .expect(201);

      const tema = res.body as TemaResumen;
      expect(tema.nombre).toBe('Excel avanzado');
      temaExcelId = tema.id;

      const guardado = await prisma.tema.findUniqueOrThrow({ where: { id: tema.id } });
      expect(guardado.empresaId).toBe(empresaAId);
      expect(guardado.nombreNormalizado).toBe('excel avanzado');
    });

    it('no admite el mismo tema escrito distinto, porque rompería el matching', async () => {
      await request(app.getHttpServer())
        .post('/temas')
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({ nombre: '  EXCEL Avanzado ' })
        .expect(409);
    });

    it('el buscador sugiere los temas existentes de la empresa', async () => {
      const res = await request(app.getHttpServer())
        .get('/temas?buscar=excel')
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(200);

      expect((res.body as TemaResumen[]).map((t) => t.nombre)).toContain('Excel avanzado');
    });

    it('un estudiante no agrega temas al catálogo', async () => {
      await request(app.getHttpServer())
        .post('/temas')
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .send({ nombre: 'Hablar en público' })
        .expect(403);
    });

    it('otra empresa no ve el catálogo ajeno', async () => {
      const res = await request(app.getHttpServer())
        .get('/temas?buscar=excel')
        .set('Authorization', `Bearer ${tokenOtraEmpresa}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('el equipo de ENACTIVA indica en qué empresa crea el tema', async () => {
      await request(app.getHttpServer())
        .post('/temas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Prevención de riesgos' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/temas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre: 'Prevención de riesgos', empresaId: empresaBId })
        .expect(201);

      const temas = await prisma.tema.findMany({ where: { empresaId: empresaBId } });
      expect(temas.map((t) => t.nombre)).toEqual(['Prevención de riesgos']);
    });

    it('nadie crea temas en la empresa de otro', async () => {
      await request(app.getHttpServer())
        .post('/temas')
        .set('Authorization', `Bearer ${tokenRrhh}`)
        .send({ nombre: 'Atención a clientes', empresaId: empresaBId })
        .expect(403);
    });
  });

  describe('mi perfil', () => {
    it('declara que puede enseñar un tema, con sus dimensiones y su nivel', async () => {
      const res = await request(app.getHttpServer())
        .post('/mi-perfil/intereses')
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({
          temaId: temaExcelId,
          tipo: 'ENSENAR',
          dimensiones: ['HABILIDAD', 'CONTENIDO'],
          nivel: 'AVANZADO',
        })
        .expect(201);

      const interes = res.body as InteresDeclarado;
      expect(interes).toMatchObject({ temaNombre: 'Excel avanzado', nivel: 'AVANZADO' });

      const guardado = await prisma.perfilInteres.findUniqueOrThrow({ where: { id: interes.id } });
      expect(guardado.empresaId).toBe(empresaAId);
    });

    it('el mismo tema se declara una sola vez por tipo, pero enseñar no impide querer aprender', async () => {
      await request(app.getHttpServer())
        .post('/mi-perfil/intereses')
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({ temaId: temaExcelId, tipo: 'ENSENAR', dimensiones: ['ACTITUD'], nivel: 'BASICO' })
        .expect(409);

      await request(app.getHttpServer())
        .post('/mi-perfil/intereses')
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({
          temaId: temaExcelId,
          tipo: 'APRENDER',
          dimensiones: ['CONTENIDO'],
          nivel: 'INTERMEDIO',
        })
        .expect(201);
    });

    it('devuelve el perfil con los datos del puesto y lo declarado', async () => {
      const res = await request(app.getHttpServer())
        .get('/mi-perfil')
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .expect(200);

      const perfil = res.body as MiPerfil;
      expect(perfil).toMatchObject({ cargo: 'Supervisor', areaNombre: 'Operaciones' });
      expect(perfil.puedoEnsenar.map((i) => i.temaNombre)).toEqual(['Excel avanzado']);
      expect(perfil.quieroAprender.map((i) => i.temaNombre)).toEqual(['Excel avanzado']);
    });

    it('guarda los intereses generales que pidió la clienta', async () => {
      const res = await request(app.getHttpServer())
        .put('/mi-perfil')
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({ interesesGenerales: 'Mejora de procesos, seguridad' })
        .expect(200);

      expect((res.body as MiPerfil).interesesGenerales).toBe('Mejora de procesos, seguridad');
    });

    it('no se puede declarar un tema de otra empresa', async () => {
      await request(app.getHttpServer())
        .post('/mi-perfil/intereses')
        .set('Authorization', `Bearer ${tokenOtraEmpresa}`)
        .send({ temaId: temaExcelId, tipo: 'ENSENAR', dimensiones: ['HABILIDAD'], nivel: 'BASICO' })
        .expect(404);
    });

    it('nadie edita ni borra la declaración de otra persona', async () => {
      const ajena = await prisma.perfilInteres.findFirstOrThrow({
        where: { empresaId: empresaAId, tipo: 'ENSENAR' },
      });

      await request(app.getHttpServer())
        .patch(`/mi-perfil/intereses/${ajena.id}`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .send({ dimensiones: ['ACTITUD'], nivel: 'BASICO' })
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/mi-perfil/intereses/${ajena.id}`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(404);

      const sigue = await prisma.perfilInteres.findUnique({ where: { id: ajena.id } });
      expect(sigue).not.toBeNull();
    });

    it('cada quien corrige y quita lo suyo', async () => {
      const propia = await prisma.perfilInteres.findFirstOrThrow({
        where: { empresaId: empresaAId, tipo: 'APRENDER' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/mi-perfil/intereses/${propia.id}`)
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({ dimensiones: ['ACTITUD'], nivel: 'BASICO' })
        .expect(200);

      expect((res.body as InteresDeclarado).dimensiones).toEqual(['ACTITUD']);

      await request(app.getHttpServer())
        .delete(`/mi-perfil/intereses/${propia.id}`)
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .expect(204);

      await expect(
        prisma.perfilInteres.findUnique({ where: { id: propia.id } }),
      ).resolves.toBeNull();
    });

    it('el equipo de ENACTIVA no tiene perfil corporativo', async () => {
      await request(app.getHttpServer())
        .get('/mi-perfil')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(403);
    });

    it('deja rastro en la auditoría sin guardar lo que la persona escribió', async () => {
      const capacitador = await prisma.usuario.findUniqueOrThrow({
        where: { email: EMAIL_CAPACITADOR },
      });
      const registros = await prisma.registroAuditoria.findMany({
        where: { actorId: capacitador.id, entidad: { in: ['PerfilInteres', 'PerfilCorporativo'] } },
      });

      expect(registros.map((r) => r.accion)).toContain('CREAR');
      expect(registros.map((r) => r.accion)).toContain('ACTUALIZAR');
      const serializado = JSON.stringify(registros, (_clave, valor: unknown) =>
        typeof valor === 'bigint' ? valor.toString() : valor,
      );
      expect(serializado).not.toContain('Mejora de procesos');
      expect(serializado).toContain('interesesGenerales');
    });
  });
});
