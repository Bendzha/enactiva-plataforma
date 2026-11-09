import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import type { DatosDeServicio, SupresionDeServicio } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ClientesInternos } from '../src/clientes.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  ALMACEN_SIN_LIMITE,
  ClientesInternosFalsos,
  ProveedorEstadoSesionFalso,
  tokenDe,
} from './utilidades.js';

const EMPRESA = 'aaaaaaaa-0000-7000-8000-000000000011';
const ANA = 'bbbbbbbb-0000-7000-8000-000000000011';
const LUIS = 'bbbbbbbb-0000-7000-8000-000000000012';
const TEMA = 'dddddddd-0000-7000-8000-000000000011';
const TALLER_QUE_LE_GUSTO = 'eeeeeeee-0000-7000-8000-000000000011';
const TALLER_QUE_DESCARTO = 'eeeeeeee-0000-7000-8000-000000000012';
const RUTA = '/interno/datos-personales';

describe('Exportar y suprimir datos personales en matching (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenAna: string;
  let tokenLuis: string;

  const limpiar = async () => {
    await prisma.puntuacionMatch.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.match.deleteMany({ where: { empresaId: EMPRESA } });
  };

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .overrideProvider(PROVEEDOR_ESTADO_SESION)
      .useValue(sesiones)
      .overrideProvider(ClientesInternos)
      .useValue(new ClientesInternosFalsos())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    for (const usuarioId of [ANA, LUIS]) {
      sesiones.agregar({
        usuarioId,
        roles: ['ESTUDIANTE'],
        nivelAdmin: null,
        empresaId: EMPRESA,
        activo: true,
      });
    }

    tokenAna = tokenDe(app, ANA);
    tokenLuis = tokenDe(app, LUIS);
  });

  beforeEach(async () => {
    await limpiar();
    await prisma.match.createMany({
      data: [
        {
          empresaId: EMPRESA,
          estudianteId: ANA,
          capacitadorId: LUIS,
          tallerId: TALLER_QUE_LE_GUSTO,
          temaId: TEMA,
          score: 83,
          decision: 'INTERESADO',
        },
        {
          empresaId: EMPRESA,
          estudianteId: ANA,
          capacitadorId: LUIS,
          tallerId: TALLER_QUE_DESCARTO,
          temaId: TEMA,
          score: 41,
          decision: 'DESCARTADO',
        },
        {
          empresaId: EMPRESA,
          estudianteId: LUIS,
          capacitadorId: ANA,
          tallerId: TALLER_QUE_LE_GUSTO,
          temaId: TEMA,
          score: 70,
          decision: 'INTERESADO',
        },
      ],
    });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const exportar = async (token: string) => {
    const res = await request(app.getHttpServer())
      .get(RUTA)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body as DatosDeServicio;
  };

  const suprimir = (token: string) =>
    request(app.getHttpServer()).delete(RUTA).set('Authorization', `Bearer ${token}`);

  /** Puntuar un match exige que ambas partes puedan responder; aquí se siembra directo. */
  const puntuar = async (
    estudianteId: string,
    autorId: string,
    papel: 'ESTUDIANTE' | 'CAPACITADOR',
  ) => {
    const match = await prisma.match.findFirstOrThrow({
      where: { estudianteId, tallerId: TALLER_QUE_LE_GUSTO },
    });
    await prisma.puntuacionMatch.create({
      data: {
        empresaId: EMPRESA,
        matchId: match.id,
        autorId,
        papel,
        seReunieron: true,
        aLaHoraAcordada: true,
        comoLoEsperaban: true,
        repetirian: true,
      },
    });
  };

  it('entrega cómo puntuó los matches, no solo lo que decidió', async () => {
    await puntuar(ANA, ANA, 'ESTUDIANTE');

    const datos = await exportar(tokenAna);

    expect(datos.contenido.comoPuntueLosMatches).toMatchObject([
      { papel: 'ESTUDIANTE', seReunieron: true },
    ]);
  });

  it('las puntuaciones que escribió como capacitadora también se van al suprimir', async () => {
    // Luis responde sobre el match de Ana: esa fila cuelga del match de ella, no del suyo, así
    // que borrar sus matches no se la llevaría.
    await puntuar(ANA, LUIS, 'CAPACITADOR');

    const { body } = await suprimir(tokenLuis).expect(200);

    expect((body as SupresionDeServicio).borrado).toMatchObject({ puntuacionesDeMatch: 1 });
    expect(await prisma.puntuacionMatch.count({ where: { autorId: LUIS } })).toBe(0);
    // El match de Ana sigue en pie: es suyo.
    expect(await prisma.match.count({ where: { estudianteId: ANA } })).toBe(2);
  });

  it('entrega las decisiones del mazo, con el score que tenían', async () => {
    const datos = await exportar(tokenAna);

    expect(datos.servicio).toBe('matching-service');
    const decisiones = datos.contenido.misDecisionesDelMazo as {
      tallerId: string;
      decision: string;
      score: number;
    }[];
    expect(decisiones).toHaveLength(2);
    expect(decisiones.map((fila) => [fila.tallerId, fila.decision, fila.score])).toEqual(
      expect.arrayContaining([
        [TALLER_QUE_LE_GUSTO, 'INTERESADO', 83],
        [TALLER_QUE_DESCARTO, 'DESCARTADO', 41],
      ]),
    );
  });

  it('cada quien ve solo sus decisiones, aunque sean del mismo taller', async () => {
    const datos = await exportar(tokenLuis);

    const decisiones = datos.contenido.misDecisionesDelMazo as { score: number }[];
    expect(decisiones).toHaveLength(1);
    expect(decisiones[0]!.score).toBe(70);
  });

  it('al suprimir se van todas las decisiones de la persona y ninguna más', async () => {
    const { body } = await suprimir(tokenAna).expect(200);

    expect((body as SupresionDeServicio).borrado).toEqual({
      decisionesDelMazo: 2,
      puntuacionesDeMatch: 0,
    });
    expect(await prisma.match.count({ where: { estudianteId: ANA } })).toBe(0);
    expect(await prisma.match.count({ where: { estudianteId: LUIS } })).toBe(1);
  });

  it('se borran enteras: aquí no queda nada que conservar', async () => {
    const { body } = await suprimir(tokenAna).expect(200);

    expect((body as SupresionDeServicio).conservado).toEqual([]);
  });

  it('lo que otros decidieron sobre sus talleres no es suyo y se queda', async () => {
    // Luis aparece como capacitador en las dos tarjetas de Ana. Esas filas son de Ana: lo que
    // decidió ella. Suprimir lo de Luis no puede llevárselas.
    await suprimir(tokenLuis).expect(200);

    expect(await prisma.match.count({ where: { capacitadorId: LUIS } })).toBe(2);
    expect(await prisma.match.count({ where: { estudianteId: LUIS } })).toBe(0);
  });

  it('sin token no se exporta ni se suprime', async () => {
    await request(app.getHttpServer()).get(RUTA).expect(401);
    await request(app.getHttpServer()).delete(RUTA).expect(401);
  });
});
