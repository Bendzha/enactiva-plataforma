import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PROVEEDOR_ESTADO_SESION } from '@enactiva/service-kit';
import {
  VALORACIONES_PARA_CONTAR_EN_EL_SCORE,
  type EstrellasDelTaller,
  type MiValoracion,
  type ReconocimientoPersona,
  type ReferenciaPublicada,
  type ValoracionDeFacilitador,
  type ValorarTallerInput,
} from '@enactiva/shared';
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

const EMPRESA = '21212121-2121-7121-8121-212121212121';
const LUIS = '22222222-2222-7222-8222-222222222221';
const ANA = '22222222-2222-7222-8222-222222222222';
const CARLA = '22222222-2222-7222-8222-222222222223';
const DIEGO = '22222222-2222-7222-8222-222222222224';
const RRHH = '22222222-2222-7222-8222-222222222225';
const TEMA = '23232323-2323-7323-8323-232323232323';

/** Las cuatro, completas: el esquema no acepta media valoración. */
const BUENA: ValorarTallerInput = {
  estrellas: { CLARIDAD: 5, SEGURIDAD: 5, APLICACION: 4, USO_DE_MATERIALES: 4 },
  asistio: true,
  referencia: '',
};
const MALA: ValorarTallerInput = {
  estrellas: { CLARIDAD: 1, SEGURIDAD: 2, APLICACION: 1, USO_DE_MATERIALES: 1 },
  asistio: true,
  referencia: '',
};

describe('Valoración del encuentro, referencias y tokens (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenLuis: string;
  let tokenAna: string;
  let tokenCarla: string;
  let tokenDiego: string;
  let tokenRrhh: string;
  let tallerPasado: string;

  const limpiar = async () => {
    await prisma.referencia.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.valoracionTaller.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.token.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.inscripcion.deleteMany({ where: { empresaId: EMPRESA } });
    await prisma.taller.deleteMany({ where: { empresaId: EMPRESA } });
  };

  /** Un taller que ya terminó, con su gente inscrita: es lo único que se puede valorar. */
  const crearTallerTerminado = async (nombre: string, inscritos: string[], dias = -3) => {
    const taller = await prisma.taller.create({
      data: {
        empresaId: EMPRESA,
        capacitadorId: LUIS,
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
    await prisma.inscripcion.createMany({
      data: inscritos.map((usuarioId) => ({ empresaId: EMPRESA, tallerId: taller.id, usuarioId })),
    });
    return taller.id;
  };

  beforeAll(async () => {
    const sesiones = new ProveedorEstadoSesionFalso();
    const identity = new IdentityClienteFalso();
    identity.agregarTema(TEMA, 'Excel avanzado');
    identity.agregarPersona(ANA, 'Ana', 'Vera');
    identity.agregarPersona(CARLA, 'Carla', 'Muñoz');
    identity.agregarPersona(DIEGO, 'Diego', 'Paredes');

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

    for (const usuarioId of [ANA, CARLA, DIEGO]) {
      sesiones.agregar({
        usuarioId,
        roles: ['ESTUDIANTE'],
        nivelAdmin: null,
        empresaId: EMPRESA,
        activo: true,
      });
    }
    sesiones.agregar({
      usuarioId: LUIS,
      roles: ['CAPACITADOR'],
      nivelAdmin: null,
      empresaId: EMPRESA,
      activo: true,
    });
    sesiones.agregar({
      usuarioId: RRHH,
      roles: ['RRHH'],
      nivelAdmin: null,
      empresaId: EMPRESA,
      activo: true,
    });

    tokenLuis = tokenDe(app, LUIS);
    tokenAna = tokenDe(app, ANA);
    tokenCarla = tokenDe(app, CARLA);
    tokenDiego = tokenDe(app, DIEGO);
    tokenRrhh = tokenDe(app, RRHH);
  });

  beforeEach(async () => {
    await limpiar();
    tallerPasado = await crearTallerTerminado('Excel para turnos', [ANA, CARLA, DIEGO]);
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const valorar = (tallerId: string, token: string, entrada: Partial<ValorarTallerInput> = {}) =>
    request(app.getHttpServer())
      .post(`/talleres/${tallerId}/valoracion`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...BUENA, ...entrada });

  const pedir = (ruta: string, token: string) =>
    request(app.getHttpServer()).get(ruta).set('Authorization', `Bearer ${token}`);

  it('guarda las cuatro estrellas, la asistencia y la referencia', async () => {
    const { body } = await valorar(tallerPasado, tokenAna, {
      referencia: 'Volveré al taller 2 porque ahora quiero arreglar unos lentes.',
    }).expect(201);

    const mia = body as MiValoracion;
    expect(mia.asistio).toBe(true);
    expect(mia.estrellas.map((fila) => [fila.dimension, fila.estrellas])).toEqual([
      ['CLARIDAD', 5],
      ['SEGURIDAD', 5],
      ['APLICACION', 4],
      ['USO_DE_MATERIALES', 4],
    ]);
    expect(mia.referencia).toMatch(/lentes/);
  });

  it('exige las cuatro preguntas: media valoración no sirve para promediar', async () => {
    await request(app.getHttpServer())
      .post(`/talleres/${tallerPasado}/valoracion`)
      .set('Authorization', `Bearer ${tokenAna}`)
      .send({ estrellas: { CLARIDAD: 5 }, asistio: true })
      .expect(400);
  });

  it('las estrellas van de 1 a 5', async () => {
    await valorar(tallerPasado, tokenAna, {
      estrellas: { CLARIDAD: 6, SEGURIDAD: 5, APLICACION: 4, USO_DE_MATERIALES: 4 },
    }).expect(400);
    await valorar(tallerPasado, tokenAna, {
      estrellas: { CLARIDAD: 0, SEGURIDAD: 5, APLICACION: 4, USO_DE_MATERIALES: 4 },
    }).expect(400);
  });

  it('no se valora un taller que todavía no termina', async () => {
    const futuro = await crearTallerTerminado('La próxima semana', [ANA], 7);

    const { body } = await valorar(futuro, tokenAna).expect(400);
    expect((body as { message: string }).message).toMatch(/todavía no termina/i);
  });

  it('solo valora quien se inscribió', async () => {
    const ajeno = await crearTallerTerminado('Sin Ana', [CARLA]);

    const { body } = await valorar(ajeno, tokenAna).expect(403);
    expect((body as { message: string }).message).toMatch(/quien se inscribió/i);
  });

  it('nadie valora un taller que dictó él mismo', async () => {
    await prisma.inscripcion.create({
      data: { empresaId: EMPRESA, tallerId: tallerPasado, usuarioId: LUIS },
    });

    const { body } = await valorar(tallerPasado, tokenLuis).expect(403);
    expect((body as { message: string }).message).toMatch(/dictaste tú/i);
  });

  it('no se valora dos veces el mismo taller', async () => {
    await valorar(tallerPasado, tokenAna).expect(201);

    const { body } = await valorar(tallerPasado, tokenAna).expect(409);
    expect((body as { message: string }).message).toMatch(/ya valoraste/i);
  });

  it('las estrellas del taller salen promediadas, nunca por persona', async () => {
    await valorar(tallerPasado, tokenAna).expect(201);
    await valorar(tallerPasado, tokenCarla, { ...MALA, asistio: false }).expect(201);

    const { body } = await pedir(`/talleres/${tallerPasado}/estrellas`, tokenLuis).expect(200);

    const estrellas = body as EstrellasDelTaller;
    expect(estrellas.cuantasValoraciones).toBe(2);
    expect(estrellas.asistieron).toBe(1);
    // (5+5+4+4 + 1+2+1+1) / 8
    expect(estrellas.promedioGeneral).toBe(2.9);
    expect(estrellas.promedioPorDimension).toContainEqual({ dimension: 'CLARIDAD', estrellas: 3 });
    expect(JSON.stringify(estrellas)).not.toContain(ANA);
  });

  it('el token del facilitador es uno por taller, no uno por valoración', async () => {
    await valorar(tallerPasado, tokenAna).expect(201);
    await valorar(tallerPasado, tokenCarla).expect(201);
    await valorar(tallerPasado, tokenDiego).expect(201);

    const { body } = await pedir(`/personas/${LUIS}/reconocimiento`, tokenAna).expect(200);

    expect((body as ReconocimientoPersona).tokens).toBe(1);
    expect(await prisma.token.count({ where: { tallerId: tallerPasado } })).toBe(1);
  });

  it('un taller sin ninguna valoración no da token', async () => {
    const { body } = await pedir(`/personas/${LUIS}/reconocimiento`, tokenAna).expect(200);

    const reconocimiento = body as ReconocimientoPersona;
    expect(reconocimiento.tokens).toBe(0);
    expect(reconocimiento.talleresDictados).toBe(1);
  });

  it('el recuento lo ve cualquiera de la empresa, no solo la persona', async () => {
    await valorar(tallerPasado, tokenAna).expect(201);

    const propio = (await pedir(`/personas/${LUIS}/reconocimiento`, tokenLuis).expect(200))
      .body as ReconocimientoPersona;
    const ajeno = (await pedir(`/personas/${LUIS}/reconocimiento`, tokenCarla).expect(200))
      .body as ReconocimientoPersona;

    expect(ajeno.tokens).toBe(propio.tokens);
  });

  it('el promedio no cuenta en el score hasta la tercera valoración', async () => {
    const ruta = `/interno/valoraciones/facilitadores?ids=${LUIS}`;

    await valorar(tallerPasado, tokenAna).expect(201);
    let promedios = (await pedir(ruta, tokenAna).expect(200)).body as ValoracionDeFacilitador[];
    expect(promedios[0]!.promedio).toBeNull();

    await valorar(tallerPasado, tokenCarla).expect(201);
    promedios = (await pedir(ruta, tokenAna).expect(200)).body as ValoracionDeFacilitador[];
    expect(promedios[0]!.promedio).toBeNull();

    await valorar(tallerPasado, tokenDiego).expect(201);
    promedios = (await pedir(ruta, tokenAna).expect(200)).body as ValoracionDeFacilitador[];
    expect(promedios[0]!.promedio).toBe(4.5);
    expect(VALORACIONES_PARA_CONTAR_EN_EL_SCORE).toBe(3);
  });

  it('la tarjeta de reconocimiento dice si ya cuenta en el score', async () => {
    await valorar(tallerPasado, tokenAna).expect(201);

    const antes = (await pedir(`/personas/${LUIS}/reconocimiento`, tokenAna).expect(200))
      .body as ReconocimientoPersona;
    expect(antes.cuentaEnElScore).toBe(false);
    // El promedio sí se muestra desde la primera: lo que espera es el efecto en el mazo.
    expect(antes.promedioEstrellas).toBe(4.5);

    await valorar(tallerPasado, tokenCarla).expect(201);
    await valorar(tallerPasado, tokenDiego).expect(201);

    const despues = (await pedir(`/personas/${LUIS}/reconocimiento`, tokenAna).expect(200))
      .body as ReconocimientoPersona;
    expect(despues.cuentaEnElScore).toBe(true);
  });

  it('la referencia se publica firmada con el nombre de quien la escribió', async () => {
    await valorar(tallerPasado, tokenAna, { referencia: 'Explicó todo con calma.' }).expect(201);

    const { body } = await pedir(`/personas/${LUIS}/referencias`, tokenCarla).expect(200);

    const referencias = body as ReferenciaPublicada[];
    expect(referencias).toHaveLength(1);
    expect(referencias[0]).toMatchObject({
      autorNombre: 'Ana Vera',
      texto: 'Explicó todo con calma.',
      oculta: false,
    });
  });

  it('una valoración sin referencia no publica nada', async () => {
    await valorar(tallerPasado, tokenAna, { referencia: '   ' }).expect(201);

    const { body } = await pedir(`/talleres/${tallerPasado}/referencias`, tokenCarla).expect(200);
    expect(body).toEqual([]);
  });

  it('RRHH la oculta con un motivo y deja de verse para el resto', async () => {
    await valorar(tallerPasado, tokenAna, { referencia: 'Un comentario desafortunado.' });
    const [referencia] = (await pedir(`/personas/${LUIS}/referencias`, tokenRrhh).expect(200))
      .body as ReferenciaPublicada[];

    await request(app.getHttpServer())
      .post(`/referencias/${referencia!.id}/ocultar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({ motivo: 'Alude a una situación personal fuera del taller' })
      .expect(201);

    const paraElResto = (await pedir(`/personas/${LUIS}/referencias`, tokenCarla).expect(200))
      .body as ReferenciaPublicada[];
    expect(paraElResto).toEqual([]);

    // No se borra: RRHH la sigue viendo, con el motivo. Esa es la diferencia con borrarla.
    const paraRrhh = (await pedir(`/personas/${LUIS}/referencias`, tokenRrhh).expect(200))
      .body as ReferenciaPublicada[];
    expect(paraRrhh[0]).toMatchObject({ oculta: true, motivoOcultada: expect.any(String) });
    expect(await prisma.referencia.count({ where: { id: referencia!.id } })).toBe(1);
  });

  it('ocultar exige explicar por qué', async () => {
    await valorar(tallerPasado, tokenAna, { referencia: 'Algo.' });
    const [referencia] = (await pedir(`/personas/${LUIS}/referencias`, tokenRrhh).expect(200))
      .body as ReferenciaPublicada[];

    await request(app.getHttpServer())
      .post(`/referencias/${referencia!.id}/ocultar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({ motivo: 'corto' })
      .expect(400);
  });

  it('quien no es RRHH no puede ocultar ni mostrar', async () => {
    await valorar(tallerPasado, tokenAna, { referencia: 'Algo que decir.' });
    const [referencia] = (await pedir(`/personas/${LUIS}/referencias`, tokenRrhh).expect(200))
      .body as ReferenciaPublicada[];

    await request(app.getHttpServer())
      .post(`/referencias/${referencia!.id}/ocultar`)
      .set('Authorization', `Bearer ${tokenLuis}`)
      .send({ motivo: 'No me gusta lo que dice de mí' })
      .expect(403);
  });

  it('se puede volver a mostrar lo que se ocultó por error', async () => {
    await valorar(tallerPasado, tokenAna, { referencia: 'Explicó todo con calma.' });
    const [referencia] = (await pedir(`/personas/${LUIS}/referencias`, tokenRrhh).expect(200))
      .body as ReferenciaPublicada[];

    await request(app.getHttpServer())
      .post(`/referencias/${referencia!.id}/ocultar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({ motivo: 'Me equivoqué de referencia al moderar' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/referencias/${referencia!.id}/ocultar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(200);

    const visibles = (await pedir(`/personas/${LUIS}/referencias`, tokenCarla).expect(200))
      .body as ReferenciaPublicada[];
    expect(visibles).toHaveLength(1);
  });

  it('tanto ocultar como mostrar quedan en la auditoría, sin el texto', async () => {
    await valorar(tallerPasado, tokenAna, { referencia: 'Un comentario desafortunado.' });
    const [referencia] = (await pedir(`/personas/${LUIS}/referencias`, tokenRrhh).expect(200))
      .body as ReferenciaPublicada[];

    await request(app.getHttpServer())
      .post(`/referencias/${referencia!.id}/ocultar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .send({ motivo: 'Alude a una situación personal fuera del taller' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/referencias/${referencia!.id}/ocultar`)
      .set('Authorization', `Bearer ${tokenRrhh}`)
      .expect(200);

    const registros = await prisma.registroAuditoria.findMany({
      where: { entidad: 'Referencia', entidadId: referencia!.id },
      orderBy: { id: 'asc' },
    });
    expect(registros).toHaveLength(2);
    expect(registros[0]!.camposModificados).toEqual(['ocultaAt', 'motivoOculta']);
    expect(registros[1]!.camposModificados).toEqual(['ocultaAt']);
    // El registro guarda nombres de campos, nunca lo que decía la referencia.
    expect(JSON.stringify(registros.map((r) => r.camposModificados))).not.toContain(
      'desafortunado',
    );
  });

  it('sin token no se valora ni se lee nada', async () => {
    await request(app.getHttpServer()).post(`/talleres/${tallerPasado}/valoracion`).expect(401);
    await request(app.getHttpServer()).get(`/talleres/${tallerPasado}/estrellas`).expect(401);
    await request(app.getHttpServer()).get(`/personas/${LUIS}/referencias`).expect(401);
  });
});
