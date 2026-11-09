import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import type { MatchPuntuado, MetricasDeMatches, TallerAbierto } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ClientesInternos } from '../src/clientes.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  ALMACEN_SIN_LIMITE,
  ClientesInternosFalsos,
  enDias,
  ProveedorEstadoSesionFalso,
  tokenDe,
} from './utilidades.js';

const EMPRESA = 'aaaaaaaa-0000-7000-8000-000000000021';
const ANA = 'bbbbbbbb-0000-7000-8000-000000000021';
const LUIS = 'bbbbbbbb-0000-7000-8000-000000000022';
const CARLA = 'bbbbbbbb-0000-7000-8000-000000000023';
const RRHH = 'bbbbbbbb-0000-7000-8000-000000000024';
const TEMA = 'dddddddd-0000-7000-8000-000000000021';
const TALLER = 'eeeeeeee-0000-7000-8000-000000000021';
const TALLER_FUTURO = 'eeeeeeee-0000-7000-8000-000000000022';

const BUENA = {
  seReunieron: true,
  aLaHoraAcordada: true,
  comoLoEsperaban: true,
  repetirian: true,
};

const taller = (id: string, dias: number): TallerAbierto => ({
  id,
  temaId: TEMA,
  capacitadorId: LUIS,
  nombre: id === TALLER ? 'Excel para turnos' : 'La próxima semana',
  objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
  resultadosEsperados: 'Un resultado que alcanza el mínimo',
  ubicacion: 'Sala 1',
  inicioAt: enDias(dias),
  finAt: enDias(dias, 12),
  cupo: 10,
  inscritos: 3,
});

describe('Puntuación del match (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clientes: ClientesInternosFalsos;
  let tokenAna: string;
  let tokenLuis: string;
  let tokenCarla: string;
  let tokenRrhh: string;

  const limpiar = () => prisma.match.deleteMany({ where: { empresaId: EMPRESA } });

  /** Un match ya decidido: es lo que existe cuando alguien hizo like a una tarjeta. */
  const crearMatch = (tallerId = TALLER, estudianteId = ANA) =>
    prisma.match.create({
      data: {
        empresaId: EMPRESA,
        estudianteId,
        capacitadorId: LUIS,
        tallerId,
        temaId: TEMA,
        score: 80,
        decision: 'INTERESADO',
      },
    });

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();
    clientes = new ClientesInternosFalsos();
    clientes.talleres = [taller(TALLER, -3), taller(TALLER_FUTURO, 7)];

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .overrideProvider(PROVEEDOR_ESTADO_SESION)
      .useValue(sesiones)
      .overrideProvider(ClientesInternos)
      .useValue(clientes)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    for (const [usuarioId, roles] of [
      [ANA, ['ESTUDIANTE']],
      [LUIS, ['CAPACITADOR']],
      [CARLA, ['ESTUDIANTE']],
      [RRHH, ['RRHH']],
    ] as const) {
      sesiones.agregar({
        usuarioId,
        roles: [...roles],
        nivelAdmin: null,
        empresaId: EMPRESA,
        activo: true,
      });
    }

    tokenAna = tokenDe(app, ANA);
    tokenLuis = tokenDe(app, LUIS);
    tokenCarla = tokenDe(app, CARLA);
    tokenRrhh = tokenDe(app, RRHH);
  });

  beforeEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const puntuar = (token: string, cuerpo: Partial<typeof BUENA> = {}, tallerId = TALLER) =>
    request(app.getHttpServer())
      .post(`/talleres/${tallerId}/puntuacion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...BUENA, ...cuerpo });

  it('guarda las cuatro respuestas de la clienta, con el papel de quien contesta', async () => {
    await crearMatch();

    const { body } = await puntuar(tokenAna).expect(201);

    const match = body as MatchPuntuado;
    expect(match.respuestas).toHaveLength(1);
    expect(match.respuestas[0]).toMatchObject({
      autorId: ANA,
      papel: 'ESTUDIANTE',
      seReunieron: true,
      aLaHoraAcordada: true,
      comoLoEsperaban: true,
      repetirian: true,
    });
  });

  it('lo contestan las dos partes, cada una desde su lado', async () => {
    await crearMatch();

    await puntuar(tokenAna).expect(201);
    const { body } = await puntuar(tokenLuis, { comoLoEsperaban: false }).expect(201);

    const match = body as MatchPuntuado;
    expect(match.respuestas.map((fila) => fila.papel)).toEqual(['ESTUDIANTE', 'CAPACITADOR']);
    expect(match.respuestas[1]!.comoLoEsperaban).toBe(false);
  });

  it('con una sola respuesta el match ya queda puntuado: nadie espera a la otra parte', async () => {
    await crearMatch();
    await puntuar(tokenAna).expect(201);

    const { body } = await request(app.getHttpServer())
      .get(`/talleres/${TALLER}/puntuacion`)
      .set('Authorization', `Bearer ${tokenLuis}`)
      .expect(200);

    expect((body as MatchPuntuado).respuestas).toHaveLength(1);
  });

  it('quien no es parte no puede puntuar, y ni siquiera sabe que el match existe', async () => {
    await crearMatch();

    // 404 y no 403: un 403 le diría a Carla que Ana y Luis hicieron match en ese taller, y lo
    // que cada quien decide en Descubrir es suyo.
    const { body } = await puntuar(tokenCarla).expect(404);
    expect((body as { message: string }).message).toMatch(/no hay un match tuyo/i);

    const consulta = await request(app.getHttpServer())
      .get(`/talleres/${TALLER}/puntuacion`)
      .set('Authorization', `Bearer ${tokenCarla}`)
      .expect(200);
    expect(consulta.body).toEqual({});
  });

  it('no se puntúa un encuentro que todavía no ocurrió', async () => {
    await crearMatch(TALLER_FUTURO);

    const { body } = await puntuar(tokenAna, {}, TALLER_FUTURO).expect(400);
    expect((body as { message: string }).message).toMatch(/todavía no termina/i);
  });

  it('nadie contesta dos veces el mismo match', async () => {
    await crearMatch();
    await puntuar(tokenAna).expect(201);

    const { body } = await puntuar(tokenAna).expect(409);
    expect((body as { message: string }).message).toMatch(/ya puntuaste/i);
  });

  it('un taller descartado no tiene match que puntuar', async () => {
    await prisma.match.create({
      data: {
        empresaId: EMPRESA,
        estudianteId: ANA,
        capacitadorId: LUIS,
        tallerId: TALLER,
        temaId: TEMA,
        score: 20,
        decision: 'DESCARTADO',
      },
    });

    await puntuar(tokenAna).expect(404);
  });

  it('los pendientes son los míos que ya terminaron y no contesté', async () => {
    await crearMatch();

    const antes = await request(app.getHttpServer())
      .get('/puntuaciones/pendientes')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(antes.body).toEqual([TALLER]);

    await puntuar(tokenAna).expect(201);

    const despues = await request(app.getHttpServer())
      .get('/puntuaciones/pendientes')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(200);
    expect(despues.body).toEqual([]);
  });

  it('el facilitador también ve el match como pendiente', async () => {
    await crearMatch();

    const { body } = await request(app.getHttpServer())
      .get('/puntuaciones/pendientes')
      .set('Authorization', `Bearer ${tokenLuis}`)
      .expect(200);

    expect(body).toEqual([TALLER]);
  });

  it('RRHH ve si los matches funcionaron, en agregado y sin nombres', async () => {
    await crearMatch();
    await crearMatch(TALLER_FUTURO, CARLA);
    await puntuar(tokenAna, { comoLoEsperaban: false }).expect(201);
    await puntuar(tokenLuis).expect(201);

    const { body } = await request(app.getHttpServer())
      .get('/metricas/matches')
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(200);

    const metricas = body as MetricasDeMatches;
    expect(metricas).toEqual({
      matchesConRespuesta: 1,
      seReunieron: 2,
      aLaHoraAcordada: 2,
      comoLoEsperaban: 1,
      repetirian: 2,
    });
    expect(JSON.stringify(metricas)).not.toContain(ANA);
  });

  it('quien no gestiona personas no ve las métricas', async () => {
    await request(app.getHttpServer())
      .get('/metricas/matches')
      .set('Authorization', `Bearer ${tokenAna}`)
      .expect(403);
  });

  it('sin token no se puntúa nada', async () => {
    await request(app.getHttpServer()).post(`/talleres/${TALLER}/puntuacion`).expect(401);
    await request(app.getHttpServer()).get('/puntuaciones/pendientes').expect(401);
  });
});
