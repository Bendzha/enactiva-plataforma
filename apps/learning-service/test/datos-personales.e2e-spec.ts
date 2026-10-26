import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { DatosDeServicio, SupresionDeServicio } from '@enactiva/shared';
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
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';

const EMPRESA = '17171717-1717-7717-8717-171717171717';
const CAMILA = '18181818-1818-7818-8818-181818181811';
const OTRA = '18181818-1818-7818-8818-181818181812';
const TEMA = '19191919-1919-7919-8919-191919191919';
const RUTA = '/interno/datos-personales';

describe('Exportar y suprimir datos personales en learning (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenCamila: string;
  let tokenOtra: string;

  const limpiar = async () => {
    await prisma.inscripcion.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.taller.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.disponibilidad.deleteMany({ where: { empresaId: EMPRESA } });
  };

  const crearTaller = (nombre: string, capacitadorId: string, dias = 5) =>
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

    for (const usuarioId of [CAMILA, OTRA]) {
      sesiones.agregar({
        usuarioId,
        roles: ['CAPACITADOR', 'ESTUDIANTE'],
        nivelAdmin: null,
        empresaId: EMPRESA,
        activo: true,
      });
    }

    tokenCamila = tokenDe(app, CAMILA);
    tokenOtra = tokenDe(app, OTRA);
    await limpiar();
  });

  beforeEach(async () => {
    await limpiar();
    const queDicta = await crearTaller('Excel para turnos', CAMILA);
    const alQueVa = await crearTaller('Primeros auxilios', OTRA, 3);
    await prisma.inscripcion.createMany({
      data: [
        { empresaId: EMPRESA, tallerId: alQueVa.id, usuarioId: CAMILA },
        // Alguien más inscrito en el taller que Camila dicta: su historia no es de ella.
        { empresaId: EMPRESA, tallerId: queDicta.id, usuarioId: OTRA },
      ],
    });
    await prisma.disponibilidad.create({
      data: {
        empresaId: EMPRESA,
        usuarioId: CAMILA,
        dia: 'MARTES',
        horaInicio: '09:00',
        horaFin: '11:00',
      },
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

  it('entrega lo que dicta, a lo que va y cuándo puede', async () => {
    const datos = await exportar(tokenCamila);

    expect(datos.servicio).toBe('learning-service');
    expect(datos.contenido.talleresQueDicto).toMatchObject([{ nombre: 'Excel para turnos' }]);
    expect(datos.contenido.talleresALosQueMeInscribi).toMatchObject([
      { taller: 'Primeros auxilios' },
    ]);
    expect(datos.contenido.miDisponibilidad).toMatchObject([
      { dia: 'MARTES', horaInicio: '09:00', horaFin: '11:00' },
    ]);
  });

  it('no entrega quiénes se inscribieron en los talleres que dicta', async () => {
    const datos = await exportar(tokenCamila);

    // Esos son datos de otras personas: están en la exportación de cada una de ellas.
    expect(JSON.stringify(datos)).not.toContain(OTRA);
  });

  it('cada quien exporta lo suyo, aunque sean de la misma empresa', async () => {
    const datos = await exportar(tokenOtra);

    expect(datos.contenido.talleresQueDicto).toMatchObject([{ nombre: 'Primeros auxilios' }]);
    expect(datos.contenido.talleresALosQueMeInscribi).toMatchObject([
      { taller: 'Excel para turnos' },
    ]);
    expect(datos.contenido.miDisponibilidad).toEqual([]);
  });

  it('al suprimir se van las inscripciones y la disponibilidad', async () => {
    const { body } = await suprimir(tokenCamila).expect(200);

    expect((body as SupresionDeServicio).borrado).toEqual({
      inscripciones: 1,
      franjasDeDisponibilidad: 1,
    });
    expect(await prisma.inscripcion.count({ where: { usuarioId: CAMILA } })).toBe(0);
    expect(await prisma.disponibilidad.count({ where: { usuarioId: CAMILA } })).toBe(0);
  });

  it('los talleres que dictó quedan, y dice por qué', async () => {
    const { body } = await suprimir(tokenCamila).expect(200);

    const taller = await prisma.taller.findFirstOrThrow({ where: { capacitadorId: CAMILA } });
    expect(taller.nombre).toBe('Excel para turnos');
    // Quedan porque otra persona se inscribió en ellos, y esa inscripción es de ella.
    expect(await prisma.inscripcion.count({ where: { tallerId: taller.id } })).toBe(1);
    expect((body as SupresionDeServicio).conservado[0]).toMatch(/otras personas se inscribieron/);
  });

  it('suprimir lo de una persona no toca lo de otra', async () => {
    await suprimir(tokenCamila).expect(200);

    expect(await prisma.inscripcion.count({ where: { usuarioId: OTRA } })).toBe(1);
    expect(await prisma.taller.count({ where: { capacitadorId: OTRA } })).toBe(1);
  });

  it('sin token no se exporta ni se suprime', async () => {
    await request(app.getHttpServer()).get(RUTA).expect(401);
    await request(app.getHttpServer()).delete(RUTA).expect(401);
  });
});
