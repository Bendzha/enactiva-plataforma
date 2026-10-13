import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import type { FranjaDisponibilidad } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, ProveedorEstadoSesionFalso, tokenDe } from './utilidades.js';

const EMPRESA = '55555555-5555-7555-8555-555555555555';
const CAPACITADOR = '66666666-6666-7666-8666-666666666661';
const ESTUDIANTE = '66666666-6666-7666-8666-666666666662';

describe('Disponibilidad del facilitador (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenCapacitador: string;
  let tokenEstudiante: string;

  const limpiar = () => prisma.disponibilidad.deleteMany({ where: { empresaId: EMPRESA } });

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .overrideProvider(PROVEEDOR_ESTADO_SESION)
      .useValue(sesiones)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    sesiones.agregar({
      usuarioId: CAPACITADOR,
      roles: ['CAPACITADOR'],
      nivelAdmin: null,
      empresaId: EMPRESA,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: ESTUDIANTE,
      roles: ['ESTUDIANTE'],
      nivelAdmin: null,
      empresaId: EMPRESA,
      activo: true,
    });

    tokenCapacitador = tokenDe(app, CAPACITADOR);
    tokenEstudiante = tokenDe(app, ESTUDIANTE);
    await limpiar();
  });

  afterEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const guardar = (franjas: FranjaDisponibilidad[], token = tokenCapacitador) =>
    request(app.getHttpServer())
      .put('/disponibilidad')
      .set('Authorization', `Bearer ${token}`)
      .send({ franjas });

  it('declara sus franjas y las devuelve ordenadas de lunes a domingo', async () => {
    const res = await guardar([
      { dia: 'MIERCOLES', horaInicio: '15:00', horaFin: '17:00' },
      { dia: 'LUNES', horaInicio: '16:00', horaFin: '18:00' },
      { dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' },
    ]).expect(200);

    expect(res.body).toEqual([
      { dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' },
      { dia: 'LUNES', horaInicio: '16:00', horaFin: '18:00' },
      { dia: 'MIERCOLES', horaInicio: '15:00', horaFin: '17:00' },
    ]);
  });

  it('guardar de nuevo reemplaza la semana completa', async () => {
    await guardar([{ dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' }]).expect(200);
    const res = await guardar([{ dia: 'VIERNES', horaInicio: '14:00', horaFin: '15:30' }]).expect(
      200,
    );

    expect(res.body).toEqual([{ dia: 'VIERNES', horaInicio: '14:00', horaFin: '15:30' }]);
  });

  it('rechaza una franja que termina antes de empezar', async () => {
    await guardar([{ dia: 'LUNES', horaInicio: '18:00', horaFin: '09:00' }]).expect(400);
  });

  it('rechaza una hora que no es una hora', async () => {
    await guardar([
      { dia: 'LUNES', horaInicio: '25:00', horaFin: '26:00' } as FranjaDisponibilidad,
    ]).expect(400);
  });

  it('quien no publica talleres no declara disponibilidad', async () => {
    await guardar(
      [{ dia: 'LUNES', horaInicio: '09:00', horaFin: '11:00' }],
      tokenEstudiante,
    ).expect(403);
  });

  it('la disponibilidad que se consulta es siempre la propia', async () => {
    await guardar([{ dia: 'JUEVES', horaInicio: '08:00', horaFin: '10:00' }]).expect(200);
    await prisma.disponibilidad.create({
      data: {
        empresaId: EMPRESA,
        usuarioId: ESTUDIANTE,
        dia: 'SABADO',
        horaInicio: '11:00',
        horaFin: '12:00',
      },
    });

    const res = await request(app.getHttpServer())
      .get('/disponibilidad')
      .set('Authorization', `Bearer ${tokenCapacitador}`)
      .expect(200);

    expect(res.body).toEqual([{ dia: 'JUEVES', horaInicio: '08:00', horaFin: '10:00' }]);
  });
});
