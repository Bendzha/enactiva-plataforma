import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import type { TallerResumen } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { IdentityCliente } from '../src/identity.cliente.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  ALMACEN_SIN_LIMITE,
  enDias,
  IdentityClienteFalso,
  ProveedorEstadoSesionFalso,
  tokenDe,
} from './utilidades.js';

const EMPRESA_A = '11111111-1111-7111-8111-111111111111';
const EMPRESA_B = '22222222-2222-7222-8222-222222222222';
const CAPACITADOR = '33333333-3333-7333-8333-333333333331';
const ESTUDIANTE = '33333333-3333-7333-8333-333333333332';
const OTRO_ESTUDIANTE = '33333333-3333-7333-8333-333333333333';
const DE_OTRA_EMPRESA = '33333333-3333-7333-8333-333333333334';
const ADMIN_ENACTIVA = '33333333-3333-7333-8333-333333333335';
const TEMA_EXCEL = '44444444-4444-7444-8444-444444444441';
const TEMA_DE_OTRA_EMPRESA = '44444444-4444-7444-8444-444444444442';

const ficha = {
  nombre: 'Excel para turnos',
  objetivo: 'Armar la planilla de turnos sin pelearse con las fórmulas',
  resultadosEsperados: 'Salir con la planilla del mes lista y entendida',
  ubicacion: 'Sala de reuniones, segundo piso',
  cupo: 2,
};

describe('Talleres convocados (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: IdentityClienteFalso;
  let tokenCapacitador: string;
  let tokenEstudiante: string;
  let tokenOtroEstudiante: string;
  let tokenOtraEmpresa: string;
  let tokenAdmin: string;

  const limpiar = async () => {
    await prisma.inscripcion.deleteMany({ where: { empresaId: { in: [EMPRESA_A, EMPRESA_B] } } });
    await prisma.taller.deleteMany({ where: { empresaId: { in: [EMPRESA_A, EMPRESA_B] } } });
    await prisma.disponibilidad.deleteMany({
      where: { empresaId: { in: [EMPRESA_A, EMPRESA_B] } },
    });
  };

  const crearTaller = (token: string, extra: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post('/talleres')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...ficha,
        temaId: TEMA_EXCEL,
        inicioAt: enDias(7),
        finAt: enDias(7, 12),
        ...extra,
      });

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();
    identity = new IdentityClienteFalso();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .overrideProvider(PROVEEDOR_ESTADO_SESION)
      .useValue(sesiones)
      .overrideProvider(IdentityCliente)
      .useValue(identity)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    sesiones.agregar({
      usuarioId: CAPACITADOR,
      roles: ['CAPACITADOR'],
      nivelAdmin: null,
      empresaId: EMPRESA_A,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: ESTUDIANTE,
      roles: ['ESTUDIANTE'],
      nivelAdmin: null,
      empresaId: EMPRESA_A,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: OTRO_ESTUDIANTE,
      roles: ['ESTUDIANTE'],
      nivelAdmin: null,
      empresaId: EMPRESA_A,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: DE_OTRA_EMPRESA,
      roles: ['CAPACITADOR'],
      nivelAdmin: null,
      empresaId: EMPRESA_B,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: ADMIN_ENACTIVA,
      roles: ['ADMIN_ENACTIVA'],
      nivelAdmin: 'PRINCIPAL',
      empresaId: null,
      activo: true,
    });

    identity.agregarTema(TEMA_EXCEL, 'Excel avanzado');

    tokenCapacitador = tokenDe(app, CAPACITADOR);
    tokenEstudiante = tokenDe(app, ESTUDIANTE);
    tokenOtroEstudiante = tokenDe(app, OTRO_ESTUDIANTE);
    tokenOtraEmpresa = tokenDe(app, DE_OTRA_EMPRESA);
    tokenAdmin = tokenDe(app, ADMIN_ENACTIVA);

    await limpiar();
  });

  afterEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  describe('publicar la ficha', () => {
    it('un capacitador publica un taller con todo lo que pidió la clienta', async () => {
      const res = await crearTaller(tokenCapacitador).expect(201);

      const taller = res.body as TallerResumen;
      expect(taller).toMatchObject({
        nombre: ficha.nombre,
        ubicacion: ficha.ubicacion,
        temaNombre: 'Excel avanzado',
        cupo: 2,
        inscritos: 0,
        cuposDisponibles: 2,
        esMio: true,
        inscrito: false,
        empezado: false,
      });
    });

    it('no se publica un taller en el pasado', async () => {
      await crearTaller(tokenCapacitador, {
        inicioAt: enDias(-2),
        finAt: enDias(-2, 12),
      }).expect(400);
    });

    it('no se publica un taller que termina antes de empezar', async () => {
      await crearTaller(tokenCapacitador, {
        inicioAt: enDias(7, 15),
        finAt: enDias(7, 9),
      }).expect(400);
    });

    it('no se publica sobre un tema que no es del catálogo de su empresa', async () => {
      await crearTaller(tokenCapacitador, { temaId: TEMA_DE_OTRA_EMPRESA }).expect(404);
    });

    it('un estudiante no publica talleres', async () => {
      await crearTaller(tokenEstudiante).expect(403);
    });

    it('el equipo de ENACTIVA no dicta talleres: no pertenece a ninguna empresa', async () => {
      await crearTaller(tokenAdmin).expect(403);
    });
  });

  describe('inscribirse', () => {
    it('alguien se inscribe y el cupo baja', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;

      const res = await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(201);

      expect(res.body).toMatchObject({ inscritos: 1, cuposDisponibles: 1, inscrito: true });
    });

    it('al llenarse el cupo, el taller deja de aceptar gente', async () => {
      const taller = (await crearTaller(tokenCapacitador, { cupo: 1 }).expect(201))
        .body as TallerResumen;

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenOtroEstudiante}`)
        .expect(409);

      const inscritos = await prisma.inscripcion.count({ where: { tallerId: taller.id } });
      expect(inscritos).toBe(1);
    });

    it('nadie se inscribe dos veces en el mismo taller', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(409);
    });

    it('el facilitador no se inscribe en su propio taller', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .expect(400);
    });

    it('quien se arrepiente cancela y libera el cupo', async () => {
      const taller = (await crearTaller(tokenCapacitador, { cupo: 1 }).expect(201))
        .body as TallerResumen;

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .delete(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(200);

      expect(res.body).toMatchObject({ inscritos: 0, cuposDisponibles: 1, inscrito: false });

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenOtroEstudiante}`)
        .expect(201);
    });

    it('no se puede cancelar algo a lo que no se inscribió', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;

      await request(app.getHttpServer())
        .delete(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(404);
    });
  });

  describe('editar la ficha', () => {
    it('el facilitador corrige su ficha mientras el taller no empiece', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;

      const res = await request(app.getHttpServer())
        .patch(`/talleres/${taller.id}`)
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({
          ...ficha,
          ubicacion: 'Casino, mesa del fondo',
          cupo: 5,
          inicioAt: enDias(8),
          finAt: enDias(8, 12),
        })
        .expect(200);

      expect(res.body).toMatchObject({ ubicacion: 'Casino, mesa del fondo', cupo: 5 });
    });

    it('el cupo no baja por debajo de la gente ya inscrita', async () => {
      const taller = (await crearTaller(tokenCapacitador, { cupo: 2 }).expect(201))
        .body as TallerResumen;

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenOtroEstudiante}`)
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/talleres/${taller.id}`)
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .send({ ...ficha, cupo: 1, inicioAt: enDias(7), finAt: enDias(7, 12) })
        .expect(409);
    });

    it('nadie edita el taller de otra persona', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;

      await request(app.getHttpServer())
        .patch(`/talleres/${taller.id}`)
        .set('Authorization', `Bearer ${tokenOtraEmpresa}`)
        .send({ ...ficha, inicioAt: enDias(7), finAt: enDias(7, 12) })
        .expect(404);
    });
  });

  describe('aislamiento entre empresas', () => {
    it('los talleres de una empresa no aparecen en otra', async () => {
      await crearTaller(tokenCapacitador).expect(201);

      const propios = await request(app.getHttpServer())
        .get('/talleres')
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(200);
      expect(propios.body).toHaveLength(1);

      const ajenos = await request(app.getHttpServer())
        .get('/talleres')
        .set('Authorization', `Bearer ${tokenOtraEmpresa}`)
        .expect(200);
      expect(ajenos.body).toEqual([]);
    });

    it('alguien de otra empresa no se inscribe en un taller ajeno', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;

      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenOtraEmpresa}`)
        .expect(404);
    });

    it('sin token no se ve nada', async () => {
      await request(app.getHttpServer()).get('/talleres').expect(401);
    });
  });

  describe('listados', () => {
    it('los talleres que ya pasaron salen del listado de la empresa, pero no del historial propio', async () => {
      await prisma.taller.create({
        data: {
          empresaId: EMPRESA_A,
          capacitadorId: CAPACITADOR,
          temaId: TEMA_EXCEL,
          ...ficha,
          inicioAt: new Date(enDias(-3)),
          finAt: new Date(enDias(-3, 12)),
        },
      });

      const proximos = await request(app.getHttpServer())
        .get('/talleres')
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(200);
      expect(proximos.body).toEqual([]);

      const mios = await request(app.getHttpServer())
        .get('/talleres/mios')
        .set('Authorization', `Bearer ${tokenCapacitador}`)
        .expect(200);
      expect((mios.body as TallerResumen[])[0]).toMatchObject({ empezado: true });
    });
  });

  describe('auditoría', () => {
    it('queda registro de publicar e inscribirse, sin datos personales', async () => {
      const taller = (await crearTaller(tokenCapacitador).expect(201)).body as TallerResumen;
      await request(app.getHttpServer())
        .post(`/talleres/${taller.id}/inscripcion`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .expect(201);

      const registros = await prisma.registroAuditoria.findMany({
        where: { entidadId: { in: [taller.id] } },
      });

      expect(registros.map((r) => `${r.accion} ${r.entidad}`)).toEqual(
        expect.arrayContaining(['CREAR Taller', 'CREAR Inscripcion']),
      );
      const serializado = JSON.stringify(registros, (_clave, valor: unknown) =>
        typeof valor === 'bigint' ? valor.toString() : valor,
      );
      expect(serializado).not.toContain(ficha.ubicacion);
    });
  });
});
