import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import { AppModule } from '../src/app.module.js';
import { IdentityCliente } from '../src/identity.cliente.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { CorreoRecordatorioService } from '../src/modules/recordatorios/correo.service.js';
import {
  RecordatoriosService,
  type ResumenEnvio,
} from '../src/modules/recordatorios/recordatorios.service.js';
import { ALMACEN_SIN_LIMITE, ProveedorEstadoSesionFalso } from './utilidades.js';

const EMPRESA = '77777777-7777-7777-8777-777777777777';
const LUIS = '88888888-8888-7888-8888-888888888881';
const ANA = '88888888-8888-7888-8888-888888888882';
const DIEGO = '88888888-8888-7888-8888-888888888883';
const TEMA = '99999999-9999-7999-8999-999999999999';

/** Doble de identity: devuelve correos y nombres de tema sin salir a la red. */
class IdentityFalso {
  destinatarios(ids: readonly string[]) {
    const gente: Record<string, { email: string; nombre: string }> = {
      [LUIS]: { email: 'luis@demo.local', nombre: 'Luis' },
      [ANA]: { email: 'ana@demo.local', nombre: 'Ana' },
      [DIEGO]: { email: 'diego@demo.local', nombre: 'Diego' },
    };
    return Promise.resolve(ids.filter((id) => gente[id]).map((id) => ({ id, ...gente[id]! })));
  }
}

/** Doble del correo: anota a quién se le escribió en vez de mandar nada. */
class CorreoFalso {
  enviados: { para: string; esInminente: boolean; dicta: boolean }[] = [];
  falla = false;

  enviar(datos: { para: string; esInminente: boolean; dicta: boolean }): Promise<boolean> {
    if (this.falla) return Promise.resolve(false);
    this.enviados.push({ para: datos.para, esInminente: datos.esInminente, dicta: datos.dicta });
    return Promise.resolve(true);
  }
}

describe('Recordatorios de taller (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let recordatorios: RecordatoriosService;
  let correo: CorreoFalso;

  const limpiar = async () => {
    await prisma.recordatorioTaller.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.inscripcion.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.taller.deleteMany({ where: { empresaId: EMPRESA } });
  };

  /** Crea un taller que empieza dentro de N minutos, con Ana y Diego inscritos. */
  const tallerEn = async (minutos: number) => {
    const inicioAt = new Date(Date.now() + minutos * 60_000);
    const taller = await prisma.taller.create({
      data: {
        empresaId: EMPRESA,
        capacitadorId: LUIS,
        temaId: TEMA,
        nombre: 'Excel para turnos',
        objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
        resultadosEsperados: 'Un resultado que alcanza el mínimo',
        ubicacion: 'Sala 1',
        inicioAt,
        finAt: new Date(inicioAt.getTime() + 2 * 60 * 60_000),
        cupo: 10,
      },
    });
    await prisma.inscripcion.createMany({
      data: [ANA, DIEGO].map((usuarioId) => ({
        empresaId: EMPRESA,
        tallerId: taller.id,
        usuarioId,
      })),
    });
    return taller;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .overrideProvider(PROVEEDOR_ESTADO_SESION)
      .useValue(new ProveedorEstadoSesionFalso())
      .overrideProvider(IdentityCliente)
      .useValue(new IdentityFalso())
      .overrideProvider(CorreoRecordatorioService)
      .useValue(new CorreoFalso())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    recordatorios = app.get(RecordatoriosService);
    correo = app.get(CorreoRecordatorioService) as unknown as CorreoFalso;
  });

  beforeEach(async () => {
    await limpiar();
    correo.enviados = [];
    correo.falla = false;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  it('un taller de mañana avisa a los inscritos y a quien lo dicta', async () => {
    await tallerEn(60 * 10);

    const resumen: ResumenEnvio = await recordatorios.enviarPendientes();

    expect(resumen.correos).toBe(3);
    expect(correo.enviados.map((e) => e.para).sort()).toEqual([
      'ana@demo.local',
      'diego@demo.local',
      'luis@demo.local',
    ]);
    // A quien dicta se le escribe distinto: a él le interesa cuánta gente va.
    expect(correo.enviados.find((e) => e.para === 'luis@demo.local')!.dicta).toBe(true);
    expect(correo.enviados.find((e) => e.para === 'ana@demo.local')!.dicta).toBe(false);
  });

  it('no manda el mismo recordatorio dos veces', async () => {
    await tallerEn(60 * 10);

    await recordatorios.enviarPendientes();
    correo.enviados = [];
    const segunda = await recordatorios.enviarPendientes();

    expect(segunda.correos).toBe(0);
    expect(correo.enviados).toEqual([]);
  });

  it('un taller que empieza en media hora recibe el de una hora, no el de mañana', async () => {
    await tallerEn(30);

    await recordatorios.enviarPendientes();

    expect(correo.enviados).toHaveLength(3);
    expect(correo.enviados.every((e) => e.esInminente)).toBe(true);

    const anotados = await prisma.recordatorioTaller.findMany({ where: { empresaId: EMPRESA } });
    expect(anotados.map((r) => r.momento)).toEqual(['UNA_HORA']);
  });

  it('los dos recordatorios salen, cada uno en su ventana', async () => {
    const taller = await tallerEn(60 * 10);

    // Primera pasada: está a diez horas, le toca el de mañana.
    await recordatorios.enviarPendientes();
    expect(correo.enviados.every((e) => !e.esInminente)).toBe(true);

    // Al rato, el taller está a media hora: ahora le toca el de una hora.
    correo.enviados = [];
    const comoSiFueranDiezHorasDespues = new Date(Date.now() + 60 * 9.5 * 60_000);
    await recordatorios.enviarPendientes(comoSiFueranDiezHorasDespues);

    expect(correo.enviados).toHaveLength(3);
    expect(correo.enviados.every((e) => e.esInminente)).toBe(true);

    const anotados = await prisma.recordatorioTaller.findMany({
      where: { tallerId: taller.id },
      orderBy: { momento: 'asc' },
    });
    expect(anotados.map((r) => r.momento).sort()).toEqual(['UNA_HORA', 'VEINTICUATRO_HORAS']);
  });

  it('un taller que ya empezó no recibe nada', async () => {
    await tallerEn(-30);

    const resumen = await recordatorios.enviarPendientes();

    expect(resumen.revisados).toBe(0);
    expect(correo.enviados).toEqual([]);
  });

  it('un taller a tres días tampoco: todavía no entra en ventana', async () => {
    await tallerEn(60 * 24 * 3);

    expect((await recordatorios.enviarPendientes()).revisados).toBe(0);
  });

  it('un taller sin inscritos igual queda anotado, para no revisarlo cada cinco minutos', async () => {
    const inicioAt = new Date(Date.now() + 60 * 60_000 * 10);
    const taller = await prisma.taller.create({
      data: {
        empresaId: EMPRESA,
        capacitadorId: LUIS,
        temaId: TEMA,
        nombre: 'Taller sin nadie',
        objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
        resultadosEsperados: 'Un resultado que alcanza el mínimo',
        ubicacion: 'Sala 2',
        inicioAt,
        finAt: new Date(inicioAt.getTime() + 60 * 60_000),
        cupo: 5,
      },
    });

    await recordatorios.enviarPendientes();

    // Igual le llega a quien lo dicta, y queda la constancia.
    const anotado = await prisma.recordatorioTaller.findFirstOrThrow({
      where: { tallerId: taller.id },
    });
    expect(anotado.enviados).toBe(1);
  });

  it('si un correo rebota, el recordatorio igual queda anotado', async () => {
    await tallerEn(60 * 10);
    correo.falla = true;

    await recordatorios.enviarPendientes();

    const anotado = await prisma.recordatorioTaller.findFirstOrThrow({
      where: { empresaId: EMPRESA },
    });
    expect(anotado.enviados).toBe(0);
  });
});
