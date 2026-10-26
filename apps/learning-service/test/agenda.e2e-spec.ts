import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import type { Agenda } from '@enactiva/shared';
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

const EMPRESA = '12121212-1212-7212-8212-121212121212';
const LUIS = '13131313-1313-7313-8313-131313131331';
const ANA = '13131313-1313-7313-8313-131313131332';
const AJENO = '13131313-1313-7313-8313-131313131333';
const TEMA = '14141414-1414-7414-8414-141414141414';

describe('Agenda de la persona (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenLuis: string;
  let tokenAna: string;

  const limpiar = async () => {
    await prisma.inscripcion.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.taller.deleteMany({ where: { empresaId: EMPRESA } });
  };

  const crearTaller = (nombre: string, dias: number, capacitadorId = LUIS) =>
    prisma.taller.create({
      data: {
        empresaId: EMPRESA,
        capacitadorId,
        temaId: TEMA,
        nombre,
        objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
        resultadosEsperados: 'Un resultado que alcanza el mínimo',
        ubicacion: 'Sala 1',
        inicioAt: new Date(enDias(dias)),
        finAt: new Date(enDias(dias, 12)),
        cupo: 10,
      },
    });

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();
    const identity = new IdentityClienteFalso();
    identity.agregarTema(TEMA, 'Excel avanzado');

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

    for (const usuarioId of [LUIS, ANA, AJENO]) {
      sesiones.agregar({
        usuarioId,
        roles: usuarioId === LUIS ? ['CAPACITADOR'] : ['ESTUDIANTE'],
        nivelAdmin: null,
        empresaId: EMPRESA,
        activo: true,
      });
    }

    tokenLuis = tokenDe(app, LUIS);
    tokenAna = tokenDe(app, ANA);
    await limpiar();
  });

  afterEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const pedirAgenda = (token: string) =>
    request(app.getHttpServer()).get('/agenda').set('Authorization', `Bearer ${token}`);

  it('junta en una sola lista lo que dicta y lo que va a aprender', async () => {
    const queDicta = await crearTaller('Excel para turnos', 5);
    const alQueVa = await crearTaller('Primeros auxilios', 3, AJENO);
    await prisma.inscripcion.create({
      data: { empresaId: EMPRESA, tallerId: alQueVa.id, usuarioId: LUIS },
    });

    const { proximos } = (await pedirAgenda(tokenLuis).expect(200)).body as Agenda;

    // Ordenados por fecha, no por papel: el martes es el martes.
    expect(proximos.map((item) => [item.nombre, item.papel])).toEqual([
      ['Primeros auxilios', 'VOY'],
      ['Excel para turnos', 'DICTO'],
    ]);
    expect(proximos[1]!.tallerId).toBe(queDicta.id);
    expect(proximos[0]!.temaNombre).toBe('Excel avanzado');
  });

  it('lo que ya pasó va abajo y con lo más reciente primero', async () => {
    const viejo = await crearTaller('Hace dos semanas', -14);
    const reciente = await crearTaller('Antier', -2);
    await crearTaller('La próxima semana', 7);

    const { proximos, pasados } = (await pedirAgenda(tokenLuis).expect(200)).body as Agenda;

    expect(proximos.map((i) => i.nombre)).toEqual(['La próxima semana']);
    expect(pasados.map((i) => i.tallerId)).toEqual([reciente.id, viejo.id]);
  });

  it('un taller que está ocurriendo sigue siendo lo próximo, no historia', async () => {
    const ahora = new Date();
    await prisma.taller.create({
      data: {
        empresaId: EMPRESA,
        capacitadorId: LUIS,
        temaId: TEMA,
        nombre: 'Está pasando',
        objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
        resultadosEsperados: 'Un resultado que alcanza el mínimo',
        ubicacion: 'Sala 1',
        inicioAt: new Date(ahora.getTime() - 30 * 60_000),
        finAt: new Date(ahora.getTime() + 60 * 60_000),
        cupo: 10,
      },
    });

    const { proximos, pasados } = (await pedirAgenda(tokenLuis).expect(200)).body as Agenda;

    expect(proximos.map((i) => i.nombre)).toEqual(['Está pasando']);
    expect(pasados).toEqual([]);
  });

  it('en la agenda de cada quien está solo lo suyo', async () => {
    await crearTaller('Excel para turnos', 5);

    const deAna = (await pedirAgenda(tokenAna).expect(200)).body as Agenda;

    expect(deAna).toEqual({ proximos: [], pasados: [] });
  });

  it('sin token no hay agenda', async () => {
    await request(app.getHttpServer()).get('/agenda').expect(401);
  });
});
