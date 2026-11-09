import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import type { ListaAsistencia, ResultadoCierreAsistencia } from '@enactiva/shared';
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

const EMPRESA = '31313131-3131-7131-8131-313131313131';
const LUIS = '32323232-3232-7232-8232-323232323231';
const ANA = '32323232-3232-7232-8232-323232323232';
const CARLA = '32323232-3232-7232-8232-323232323233';
const DIEGO = '32323232-3232-7232-8232-323232323234';
const SOFIA = '32323232-3232-7232-8232-323232323235';
const PABLO = '32323232-3232-7232-8232-323232323236';
const TEMA = '33333333-3333-7333-8333-333333333333';

describe('Lista de asistencia y tokens (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenLuis: string;
  let tokenAna: string;

  const limpiar = async () => {
    await prisma.token.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.inscripcion.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.taller.deleteMany({ where: { empresaId: EMPRESA } });
  };

  const crearTaller = async (inscritos: string[], dias = -3) => {
    const taller = await prisma.taller.create({
      data: {
        empresaId: EMPRESA,
        capacitadorId: LUIS,
        temaId: TEMA,
        nombre: 'Tableros sin misterio',
        objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
        resultadosEsperados: 'Un resultado que alcanza el mínimo',
        ubicacion: 'Taller de mantención',
        inicioAt: new Date(enDias(dias)),
        finAt: new Date(enDias(dias, 12)),
        cupo: 20,
      },
    });
    if (inscritos.length > 0) {
      await prisma.inscripcion.createMany({
        data: inscritos.map((usuarioId) => ({
          empresaId: EMPRESA,
          tallerId: taller.id,
          usuarioId,
        })),
      });
    }
    return taller.id;
  };

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();
    const identity = new IdentityClienteFalso();
    identity.agregarTema(TEMA, 'Mantención eléctrica');
    identity.agregarContacto(ANA, 'Ana', 'Vera', 'ana@planta.local');
    identity.agregarContacto(CARLA, 'Carla', 'Muñoz', 'carla@planta.local');
    identity.agregarContacto(DIEGO, 'Diego', 'Paredes', 'diego@planta.local');
    identity.agregarContacto(SOFIA, 'Sofía', 'Leiva', 'sofia@planta.local');
    identity.agregarContacto(PABLO, 'Pablo', 'Rojas', 'pablo@planta.local');

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
      usuarioId: LUIS,
      roles: ['CAPACITADOR'],
      nivelAdmin: null,
      empresaId: EMPRESA,
      activo: true,
    });
    for (const usuarioId of [ANA, CARLA, DIEGO, SOFIA, PABLO]) {
      sesiones.agregar({
        usuarioId,
        roles: ['ESTUDIANTE'],
        nivelAdmin: null,
        empresaId: EMPRESA,
        activo: true,
      });
    }

    tokenLuis = tokenDe(app, LUIS);
    tokenAna = tokenDe(app, ANA);
  });

  beforeEach(limpiar);

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const verLista = (tallerId: string, token = tokenLuis) =>
    request(app.getHttpServer())
      .get(`/talleres/${tallerId}/asistencia`)
      .set('Authorization', `Bearer ${token}`);

  const pasarLista = (tallerId: string, asistieron: string[], cerrar = false, token = tokenLuis) =>
    request(app.getHttpServer())
      .put(`/talleres/${tallerId}/asistencia`)
      .set('Authorization', `Bearer ${token}`)
      .send({ asistieron, cerrar });

  const tokensDe = (usuarioId: string) =>
    prisma.token.aggregate({ where: { usuarioId }, _sum: { cantidad: true } });

  it('quien dicta ve a sus inscritos con nombre y correo, ordenados', async () => {
    const taller = await crearTaller([DIEGO, ANA, CARLA]);

    const { body } = await verLista(taller).expect(200);

    const lista = body as ListaAsistencia;
    expect(lista.tallerNombre).toBe('Tableros sin misterio');
    expect(lista.termino).toBe(true);
    expect(lista.cerradaAt).toBeNull();
    expect(lista.inscritos.map((fila) => fila.nombre)).toEqual([
      'Ana Vera',
      'Carla Muñoz',
      'Diego Paredes',
    ]);
    expect(lista.inscritos[0]!.email).toBe('ana@planta.local');
    expect(lista.inscritos.every((fila) => fila.asistio === null)).toBe(true);
  });

  it('nadie más ve la lista, ni siquiera quien está en ella', async () => {
    const taller = await crearTaller([ANA, CARLA]);

    // 404 y no 403: un 403 le confirmaría a Ana que ese taller existe y quién lo dicta.
    await verLista(taller, tokenAna).expect(404);
  });

  it('las marcas se guardan sin cerrar, y se pueden corregir', async () => {
    const taller = await crearTaller([ANA, CARLA, DIEGO]);

    await pasarLista(taller, [ANA, CARLA]).expect(200);
    let lista = (await verLista(taller).expect(200)).body as ListaAsistencia;
    expect(lista.inscritos.filter((fila) => fila.asistio).map((f) => f.nombre)).toEqual([
      'Ana Vera',
      'Carla Muñoz',
    ]);
    expect(lista.cerradaAt).toBeNull();

    await pasarLista(taller, [DIEGO]).expect(200);
    lista = (await verLista(taller).expect(200)).body as ListaAsistencia;
    expect(lista.inscritos.filter((fila) => fila.asistio).map((f) => f.nombre)).toEqual([
      'Diego Paredes',
    ]);

    // Guardar no reparte nada: los tokens esperan al cierre.
    expect(await prisma.token.count({ where: { tallerId: taller } })).toBe(0);
  });

  it('menos de cinco inscritos y no van todos: dos tokens para quien dicta', async () => {
    const taller = await crearTaller([ANA, CARLA, DIEGO]);

    const { body } = await pasarLista(taller, [ANA, CARLA], true).expect(200);

    expect((body as ResultadoCierreAsistencia).tokensParaQuienEnsena).toBe(2);
    expect((await tokensDe(LUIS))._sum.cantidad).toBe(2);
  });

  it('si van todos los inscritos, quien dicta gana uno más', async () => {
    const taller = await crearTaller([ANA, CARLA, DIEGO]);

    const { body } = await pasarLista(taller, [ANA, CARLA, DIEGO], true).expect(200);

    expect((body as ResultadoCierreAsistencia).tokensParaQuienEnsena).toBe(3);
    expect((await tokensDe(LUIS))._sum.cantidad).toBe(3);
    // Queda explicado de dónde salió cada uno, no como un saldo suelto.
    const motivos = await prisma.token.findMany({
      where: { tallerId: taller, usuarioId: LUIS },
      select: { motivo: true, cantidad: true },
      orderBy: { motivo: 'asc' },
    });
    expect(motivos).toEqual([
      { motivo: 'DICTAR_TALLER', cantidad: 2 },
      { motivo: 'ASISTENCIA_COMPLETA', cantidad: 1 },
    ]);
  });

  it('con cinco inscritos o más el tramo sube a tres, y a cuatro si van todos', async () => {
    const lleno = await crearTaller([ANA, CARLA, DIEGO, SOFIA, PABLO]);
    await pasarLista(lleno, [ANA, CARLA, DIEGO, SOFIA], true).expect(200);
    expect((await tokensDe(LUIS))._sum.cantidad).toBe(3);

    await limpiar();
    const completo = await crearTaller([ANA, CARLA, DIEGO, SOFIA, PABLO]);
    await pasarLista(completo, [ANA, CARLA, DIEGO, SOFIA, PABLO], true).expect(200);
    expect((await tokensDe(LUIS))._sum.cantidad).toBe(4);
  });

  it('cada persona que asistió gana su token; quien faltó, no', async () => {
    const taller = await crearTaller([ANA, CARLA, DIEGO]);

    const { body } = await pasarLista(taller, [ANA, CARLA], true).expect(200);

    expect((body as ResultadoCierreAsistencia).personasQueGanaronToken).toBe(2);
    expect((await tokensDe(ANA))._sum.cantidad).toBe(1);
    expect((await tokensDe(CARLA))._sum.cantidad).toBe(1);
    expect((await tokensDe(DIEGO))._sum.cantidad).toBeNull();
  });

  it('un taller al que no fue nadie no reparte nada', async () => {
    const taller = await crearTaller([ANA, CARLA]);

    const { body } = await pasarLista(taller, [], true).expect(200);

    expect((body as ResultadoCierreAsistencia).tokensParaQuienEnsena).toBe(2);
    // Dos por haberlo dictado, pero ninguno por asistencia completa ni para nadie más.
    expect(await prisma.token.count({ where: { tallerId: taller } })).toBe(1);
  });

  it('un taller sin inscritos no da nada, aunque "menos de 5" lo incluiría', async () => {
    const taller = await crearTaller([]);

    const { body } = await pasarLista(taller, [], true).expect(200);

    expect((body as ResultadoCierreAsistencia).tokensParaQuienEnsena).toBe(0);
    expect(await prisma.token.count({ where: { tallerId: taller } })).toBe(0);
  });

  it('la lista no se cierra dos veces: los tokens ya están repartidos', async () => {
    const taller = await crearTaller([ANA, CARLA]);
    await pasarLista(taller, [ANA, CARLA], true).expect(200);

    const { body } = await pasarLista(taller, [ANA], true).expect(409);
    expect((body as { message: string }).message).toMatch(/ya está cerrada/i);
    expect((await tokensDe(LUIS))._sum.cantidad).toBe(3);
  });

  it('no se pasa lista de un taller que todavía no termina', async () => {
    const taller = await crearTaller([ANA], 7);

    const { body } = await pasarLista(taller, [ANA], true).expect(400);
    expect((body as { message: string }).message).toMatch(/todavía no termina/i);
  });

  it('no se puede marcar a alguien que no se inscribió', async () => {
    const taller = await crearTaller([ANA]);

    const { body } = await pasarLista(taller, [ANA, PABLO], true).expect(400);
    expect((body as { message: string }).message).toMatch(/no están inscritas/i);
    expect(await prisma.token.count({ where: { tallerId: taller } })).toBe(0);
  });

  it('la lista anticipa lo que se va a ganar antes de cerrar', async () => {
    const taller = await crearTaller([ANA, CARLA, DIEGO]);

    await pasarLista(taller, [ANA, CARLA]).expect(200);
    let lista = (await verLista(taller).expect(200)).body as ListaAsistencia;
    expect(lista.tokensSiCierra).toBe(2);

    await pasarLista(taller, [ANA, CARLA, DIEGO]).expect(200);
    lista = (await verLista(taller).expect(200)).body as ListaAsistencia;
    expect(lista.tokensSiCierra).toBe(3);
  });

  it('el cierre queda en la auditoría, sin nombres ni correos', async () => {
    const taller = await crearTaller([ANA, CARLA]);
    await pasarLista(taller, [ANA, CARLA], true).expect(200);

    const registros = await prisma.registroAuditoria.findMany({
      where: { entidad: 'Asistencia', entidadId: taller },
    });
    expect(registros).toHaveLength(1);
    expect(registros[0]!.camposModificados).toEqual(['asistio', 'asistenciaCerradaAt', 'tokens']);
    expect(registros.map((registro) => registro.entidadId)).toEqual([taller]);
    expect(registros[0]!.camposModificados.join(' ')).not.toContain('@');
  });

  it('sin token no se ve ni se pasa lista', async () => {
    const taller = await crearTaller([ANA]);

    await request(app.getHttpServer()).get(`/talleres/${taller}/asistencia`).expect(401);
    await request(app.getHttpServer()).put(`/talleres/${taller}/asistencia`).expect(401);
  });
});
