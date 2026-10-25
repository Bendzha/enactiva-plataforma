import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ErrorServicioInterno, PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import type { ResultadoDecision, TallerAbierto, TarjetaMazo } from '@enactiva/shared';
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

const EMPRESA = 'aaaaaaaa-0000-7000-8000-000000000001';
const OTRA_EMPRESA = 'aaaaaaaa-0000-7000-8000-000000000002';
const ANA = 'bbbbbbbb-0000-7000-8000-000000000001';
const LUIS = 'bbbbbbbb-0000-7000-8000-000000000002';
const CARLA = 'bbbbbbbb-0000-7000-8000-000000000003';
const DE_OTRA_EMPRESA = 'bbbbbbbb-0000-7000-8000-000000000004';
const ADMIN = 'bbbbbbbb-0000-7000-8000-000000000005';
const AREA_OPERACIONES = 'cccccccc-0000-7000-8000-000000000001';
const AREA_MANTENCION = 'cccccccc-0000-7000-8000-000000000002';
const TEMA_EXCEL = 'dddddddd-0000-7000-8000-000000000001';
const TEMA_INGLES = 'dddddddd-0000-7000-8000-000000000002';
const TALLER_EXCEL = 'eeeeeeee-0000-7000-8000-000000000001';
const TALLER_INGLES = 'eeeeeeee-0000-7000-8000-000000000002';

const taller = (
  extra: Partial<TallerAbierto> & Pick<TallerAbierto, 'id' | 'temaId'>,
): TallerAbierto => ({
  capacitadorId: LUIS,
  nombre: 'Taller',
  objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
  resultadosEsperados: 'Un resultado que alcanza el mínimo',
  ubicacion: 'Sala 1',
  inicioAt: enDias(5),
  finAt: enDias(5, 12),
  cupo: 10,
  inscritos: 2,
  ...extra,
});

describe('Mazo del swipe (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let clientes: ClientesInternosFalsos;
  let tokenAna: string;
  let tokenOtraEmpresa: string;
  let tokenAdmin: string;

  const limpiar = () =>
    prisma.match.deleteMany({ where: { empresaId: { in: [EMPRESA, OTRA_EMPRESA] } } });

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();
    clientes = new ClientesInternosFalsos();

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

    sesiones.agregar({
      usuarioId: ANA,
      roles: ['ESTUDIANTE'],
      nivelAdmin: null,
      empresaId: EMPRESA,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: DE_OTRA_EMPRESA,
      roles: ['ESTUDIANTE'],
      nivelAdmin: null,
      empresaId: OTRA_EMPRESA,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: ADMIN,
      roles: ['ADMIN_ENACTIVA'],
      nivelAdmin: 'PRINCIPAL',
      empresaId: null,
      activo: true,
    });

    tokenAna = tokenDe(app, ANA);
    tokenOtraEmpresa = tokenDe(app, DE_OTRA_EMPRESA);
    tokenAdmin = tokenDe(app, ADMIN);
  });

  beforeEach(async () => {
    await limpiar();
    clientes.inscripciones = [];
    clientes.alInscribir = () => Promise.resolve({});
    clientes.talleres = [
      taller({ id: TALLER_EXCEL, temaId: TEMA_EXCEL, nombre: 'Excel para turnos' }),
      taller({
        id: TALLER_INGLES,
        temaId: TEMA_INGLES,
        nombre: 'Inglés para faena',
        capacitadorId: CARLA,
        inicioAt: enDias(9),
        finAt: enDias(9, 12),
      }),
    ];
    clientes.contexto = {
      personas: [
        {
          id: ANA,
          nombre: 'Ana',
          apellido: 'Vera',
          cargo: 'Analista',
          areaId: AREA_OPERACIONES,
          areaNombre: 'Operaciones',
        },
        {
          id: LUIS,
          nombre: 'Luis',
          apellido: 'Soto',
          cargo: 'Supervisor',
          areaId: AREA_OPERACIONES,
          areaNombre: 'Operaciones',
        },
        {
          id: CARLA,
          nombre: 'Carla',
          apellido: 'Muñoz',
          cargo: 'Técnica',
          areaId: AREA_MANTENCION,
          areaNombre: 'Mantención',
        },
      ],
      declaraciones: [
        {
          usuarioId: ANA,
          temaId: TEMA_EXCEL,
          tipo: 'APRENDER',
          dimensiones: ['CONTENIDO'],
          nivel: 'BASICO',
        },
        {
          usuarioId: LUIS,
          temaId: TEMA_EXCEL,
          tipo: 'ENSENAR',
          dimensiones: ['CONTENIDO', 'HABILIDAD'],
          nivel: 'AVANZADO',
        },
      ],
      temas: [
        { id: TEMA_EXCEL, nombre: 'Excel avanzado' },
        { id: TEMA_INGLES, nombre: 'Inglés técnico' },
      ],
    };
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const pedirMazo = (token = tokenAna, query = '') =>
    request(app.getHttpServer()).get(`/mazo${query}`).set('Authorization', `Bearer ${token}`);

  describe('qué muestra y en qué orden', () => {
    it('pone primero lo que más calza con lo que la persona declaró', async () => {
      const res = await pedirMazo().expect(200);
      const tarjetas = res.body as TarjetaMazo[];

      expect(tarjetas.map((t) => t.nombre)).toEqual(['Excel para turnos', 'Inglés para faena']);
      expect(tarjetas[0]!.score).toBe(100);
      // El de inglés: nadie declaró nada y es de otra área.
      expect(tarjetas[1]!.score).toBe(0);
    });

    it('la tarjeta dice quién dicta el taller y si es de tu área', async () => {
      const [excel] = (await pedirMazo().expect(200)).body as TarjetaMazo[];

      expect(excel!.facilitador).toMatchObject({
        nombre: 'Luis Soto',
        cargo: 'Supervisor',
        area: 'Operaciones',
        mismaArea: true,
      });
      expect(excel!.temaNombre).toBe('Excel avanzado');
      expect(excel!.cuposDisponibles).toBe(8);
    });

    it('explica en una línea por qué esa tarjeta salió ahí', async () => {
      const [excel, ingles] = (await pedirMazo().expect(200)).body as TarjetaMazo[];

      expect(excel!.porQue).toContain('querías aprender Excel avanzado');
      expect(excel!.porQue).toContain('trabaja en tu área');
      expect(ingles!.porQue).toContain('no habías declarado');
    });

    it('el filtro por tema es opcional y busca sin tildes', async () => {
      const filtrado = (await pedirMazo(tokenAna, '?buscar=ingles').expect(200))
        .body as TarjetaMazo[];

      expect(filtrado.map((t) => t.temaNombre)).toEqual(['Inglés técnico']);
    });

    it('sin talleres abiertos, el mazo viene vacío', async () => {
      clientes.talleres = [];
      expect((await pedirMazo().expect(200)).body).toEqual([]);
    });

    it('un taller cuyo facilitador no existe para esta empresa no arma tarjeta', async () => {
      clientes.talleres = [
        taller({ id: TALLER_EXCEL, temaId: TEMA_EXCEL, capacitadorId: DE_OTRA_EMPRESA }),
      ];

      expect((await pedirMazo().expect(200)).body).toEqual([]);
    });

    it('el equipo de ENACTIVA no tiene mazo: no pertenece a ninguna empresa', async () => {
      await pedirMazo(tokenAdmin).expect(403);
    });

    it('sin token no hay mazo', async () => {
      await request(app.getHttpServer()).get('/mazo').expect(401);
    });
  });

  describe('decidir una tarjeta', () => {
    const decidir = (tallerId: string, decision: string, token = tokenAna) =>
      request(app.getHttpServer())
        .post(`/mazo/${tallerId}/decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision });

    it('el me interesa inscribe de inmediato y guarda el match', async () => {
      const res = await decidir(TALLER_EXCEL, 'INTERESADO').expect(201);

      expect(res.body as ResultadoDecision).toMatchObject({
        decision: 'INTERESADO',
        inscrito: true,
      });
      expect(clientes.inscripciones).toEqual([TALLER_EXCEL]);

      const match = await prisma.match.findFirstOrThrow({
        where: { estudianteId: ANA, tallerId: TALLER_EXCEL },
      });
      expect(match).toMatchObject({ decision: 'INTERESADO', score: 100, capacitadorId: LUIS });
    });

    it('el descarte no inscribe a nadie', async () => {
      await decidir(TALLER_INGLES, 'DESCARTADO').expect(201);

      expect(clientes.inscripciones).toEqual([]);
      const match = await prisma.match.findFirstOrThrow({ where: { tallerId: TALLER_INGLES } });
      expect(match.decision).toBe('DESCARTADO');
    });

    it('lo descartado no vuelve a aparecer en el mazo', async () => {
      await decidir(TALLER_EXCEL, 'DESCARTADO').expect(201);

      const tarjetas = (await pedirMazo().expect(200)).body as TarjetaMazo[];
      expect(tarjetas.map((t) => t.tallerId)).toEqual([TALLER_INGLES]);
    });

    it('si cancela la inscripción, la tarjeta vuelve al mazo', async () => {
      await decidir(TALLER_EXCEL, 'INTERESADO').expect(201);

      // Mientras está inscrita, learning no devuelve ese taller y la tarjeta no aparece.
      clientes.talleres = clientes.talleres.filter((taller) => taller.id !== TALLER_EXCEL);
      let tarjetas = (await pedirMazo().expect(200)).body as TarjetaMazo[];
      expect(tarjetas.map((t) => t.tallerId)).toEqual([TALLER_INGLES]);

      // Cancela desde Talleres: para learning vuelve a estar abierto, y el mazo tiene que
      // mostrarlo de nuevo. Esconderlo por el "me interesa" anterior lo dejaba en el limbo.
      clientes.talleres = [
        taller({ id: TALLER_EXCEL, temaId: TEMA_EXCEL, nombre: 'Excel para turnos' }),
        ...clientes.talleres,
      ];
      tarjetas = (await pedirMazo().expect(200)).body as TarjetaMazo[];
      expect(tarjetas.map((t) => t.tallerId)).toContain(TALLER_EXCEL);
    });

    it('se puede volver a tomar un taller que se había cancelado', async () => {
      await decidir(TALLER_EXCEL, 'INTERESADO').expect(201);
      // Vuelve a dar "me interesa" después de cancelar: vale la última decisión, no choca.
      const res = await decidir(TALLER_EXCEL, 'INTERESADO').expect(201);

      expect(res.body as ResultadoDecision).toMatchObject({ inscrito: true });
      const matches = await prisma.match.findMany({ where: { tallerId: TALLER_EXCEL } });
      expect(matches).toHaveLength(1);
      expect(matches[0]!.decision).toBe('INTERESADO');
    });

    it('un taller descartado ya no se puede decidir: no está en el mazo', async () => {
      await decidir(TALLER_EXCEL, 'DESCARTADO').expect(201);
      await decidir(TALLER_EXCEL, 'INTERESADO').expect(404);
    });

    it('si el cupo se llenó entremedio, lo dice y no guarda la decisión', async () => {
      clientes.alInscribir = () =>
        Promise.reject(
          new ErrorServicioInterno(409, 'learning-service', 'El taller ya no tiene cupos'),
        );

      const res = await decidir(TALLER_EXCEL, 'INTERESADO').expect(201);

      expect(res.body as ResultadoDecision).toMatchObject({
        inscrito: false,
        mensaje: 'El taller ya no tiene cupos',
      });
      // Sin inscripción no se guarda: si se libera un cupo, la tarjeta tiene que poder volver.
      await expect(
        prisma.match.findFirst({ where: { tallerId: TALLER_EXCEL } }),
      ).resolves.toBeNull();
    });

    it('no se puede decidir un taller que no está en el mazo', async () => {
      await decidir('eeeeeeee-0000-7000-8000-00000000ffff', 'INTERESADO').expect(404);
    });

    it('lo que una persona descarta no le quita la tarjeta a otra', async () => {
      await decidir(TALLER_EXCEL, 'DESCARTADO').expect(201);

      // El descarte es de Ana, no de su empresa: para cualquier otra persona la tarjeta sigue.
      const deOtro = (await pedirMazo(tokenOtraEmpresa).expect(200)).body as TarjetaMazo[];
      expect(deOtro.map((t) => t.tallerId)).toContain(TALLER_EXCEL);

      // Y el match queda anotado en la empresa de quien decidió, no en la otra.
      const deLaEmpresa = await prisma.match.findMany({ where: { empresaId: EMPRESA } });
      const deLaOtra = await prisma.match.findMany({ where: { empresaId: OTRA_EMPRESA } });
      expect(deLaEmpresa).toHaveLength(1);
      expect(deLaOtra).toEqual([]);
    });

    // Que los talleres y las personas de otra empresa ni siquiera lleguen hasta aquí lo
    // garantizan learning e identity con su acotado, y está probado en cada uno de ellos. Este
    // servicio no los puede filtrar porque no es dueño de esos datos.
  });

  describe('auditoría', () => {
    it('queda registro de la decisión, sin datos personales', async () => {
      await request(app.getHttpServer())
        .post(`/mazo/${TALLER_EXCEL}/decision`)
        .set('Authorization', `Bearer ${tokenAna}`)
        .send({ decision: 'INTERESADO' })
        .expect(201);

      const registros = await prisma.registroAuditoria.findMany({
        where: { actorId: ANA, entidad: 'Match' },
      });

      expect(registros.length).toBeGreaterThan(0);
      expect(registros[0]!.camposModificados).toContain('decision');
      const serializado = JSON.stringify(registros, (_clave, valor: unknown) =>
        typeof valor === 'bigint' ? valor.toString() : valor,
      );
      expect(serializado).not.toContain('Ana');
    });
  });
});
