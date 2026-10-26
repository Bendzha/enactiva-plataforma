import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import {
  CONFIRMACION_SUPRESION,
  type ExportacionDatos,
  type ResultadoSupresion,
} from '@enactiva/shared';
import type { AddressInfo } from 'node:net';
import request from 'supertest';

/**
 * Exportación y supresión de punta a punta (Ley 21.719, SPEC §3.7).
 *
 * Es el único test que levanta los tres servicios con base de datos a la vez, y es necesario:
 * lo que se prueba aquí —que los datos de una persona se juntan desde tres bases y que la
 * supresión llega a las tres— no existe dentro de ningún servicio.
 */

const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL = 'datos.gateway@plataforma.local';
const TEMA = 'dddddddd-0000-7000-8000-00000000ff01';
const TALLER_AJENO = 'eeeeeeee-0000-7000-8000-00000000ff02';

const ALMACEN_SIN_LIMITE = {
  increment: async () => ({
    totalHits: 1,
    timeToExpire: 60,
    isBlocked: false,
    timeToBlockExpire: 0,
  }),
};

describe('Datos personales a través del gateway (e2e)', () => {
  let identityApp: INestApplication;
  let learningApp: INestApplication;
  let matchingApp: INestApplication;
  let gateway: INestApplication;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let identityPrisma: any;
  let learningPrisma: any;
  let matchingPrisma: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
  let limpiarEnvGateway: () => void;
  let token: string;
  let usuarioId: string;
  let empresaId: string;

  const levantar = async (modulo: unknown) => {
    const ref = await Test.createTestingModule({ imports: [modulo as never] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();
    const app = ref.createNestApplication();
    await app.listen(0);
    return app;
  };

  const puertoDe = (app: INestApplication) => (app.getHttpServer().address() as AddressInfo).port;

  beforeAll(async () => {
    // identity primero: los otros dos le preguntan por la sesión, y la URL se fija al importar
    // su módulo. Por eso cada uno se importa recién cuando su dependencia ya tiene puerto.
    const { AppModule: IdentityAppModule } = await import('identity-service/src/app.module.js');
    const { PrismaService: IdentityPrisma } =
      await import('identity-service/src/prisma/prisma.service.js');
    identityApp = await levantar(IdentityAppModule);
    identityPrisma = identityApp.get(IdentityPrisma);
    process.env.URL_IDENTITY_SERVICE = `http://localhost:${puertoDe(identityApp)}`;

    const { limpiarCacheEnv: limpiarLearning } = await import('learning-service/src/config/env.js');
    limpiarLearning();
    const { AppModule: LearningAppModule } = await import('learning-service/src/app.module.js');
    const { PrismaService: LearningPrisma } =
      await import('learning-service/src/prisma/prisma.service.js');
    learningApp = await levantar(LearningAppModule);
    learningPrisma = learningApp.get(LearningPrisma);
    process.env.URL_LEARNING_SERVICE = `http://localhost:${puertoDe(learningApp)}`;

    const { limpiarCacheEnv: limpiarMatching } = await import('matching-service/src/config/env.js');
    limpiarMatching();
    const { AppModule: MatchingAppModule } = await import('matching-service/src/app.module.js');
    const { PrismaService: MatchingPrisma } =
      await import('matching-service/src/prisma/prisma.service.js');
    matchingApp = await levantar(MatchingAppModule);
    matchingPrisma = matchingApp.get(MatchingPrisma);
    process.env.URL_MATCHING_SERVICE = `http://localhost:${puertoDe(matchingApp)}`;

    const { limpiarCacheEnv } = await import('../src/config/env.js');
    limpiarEnvGateway = limpiarCacheEnv;
    limpiarEnvGateway();
    const { AppModule } = await import('../src/app.module.js');
    const { configurarGateway } = await import('../src/configurar.js');

    const gatewayRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    gateway = gatewayRef.createNestApplication({ bodyParser: false });
    configurarGateway(gateway);
    await gateway.init();
  });

  const limpiar = async () => {
    const empresas = await identityPrisma.empresa.findMany({
      where: { nombre: { contains: '(datos gateway e2e)' } },
      select: { id: true },
    });
    const ids = empresas.map((empresa: { id: string }) => empresa.id);
    await identityPrisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await identityPrisma.empresa.deleteMany({ where: { id: { in: ids } } });
    for (const id of ids) {
      await learningPrisma.inscripcion.deleteMany({ where: { empresaId: id } });
      await learningPrisma.taller.deleteMany({ where: { empresaId: id } });
      await learningPrisma.disponibilidad.deleteMany({ where: { empresaId: id } });
      await matchingPrisma.match.deleteMany({ where: { empresaId: id } });
    }
  };

  beforeEach(async () => {
    await limpiar();

    const { hashPassword } = await import('identity-service/src/common/password.js');
    const { JwtService } = await import('@nestjs/jwt');
    const emailAdmin = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
    const admin = await identityPrisma.usuario.findUniqueOrThrow({ where: { email: emailAdmin } });

    const empresa = await identityPrisma.empresa.create({
      data: { nombre: 'Planta Este (datos gateway e2e)', rubro: 'Minería', creadaPorId: admin.id },
    });
    empresaId = empresa.id;

    const tema = await identityPrisma.tema.create({
      data: { id: TEMA, empresaId, nombre: 'Excel avanzado', nombreNormalizado: 'excel avanzado' },
    });
    const usuario = await identityPrisma.usuario.create({
      data: {
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD_PRUEBA),
        nombre: 'Camila',
        apellido: 'Reyes',
        estado: 'ACTIVO',
        empresaId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
    usuarioId = usuario.id;

    await identityPrisma.perfilInteres.create({
      data: {
        empresaId,
        usuarioId,
        temaId: tema.id,
        tipo: 'APRENDER',
        dimensiones: ['CONTENIDO'],
        nivel: 'BASICO',
      },
    });

    // Lo mismo repartido en las otras dos bases: un taller ajeno al que se inscribió, y la
    // decisión con la que lo eligió desde el mazo.
    await learningPrisma.taller.create({
      data: {
        id: TALLER_AJENO,
        empresaId,
        capacitadorId: admin.id,
        temaId: tema.id,
        nombre: 'Primeros auxilios',
        objetivo: 'Un objetivo que alcanza el mínimo de caracteres',
        resultadosEsperados: 'Un resultado que alcanza el mínimo',
        ubicacion: 'Sala 1',
        inicioAt: new Date(Date.now() + 5 * 86_400_000),
        finAt: new Date(Date.now() + 5 * 86_400_000 + 7_200_000),
        cupo: 10,
      },
    });
    await learningPrisma.inscripcion.create({
      data: { empresaId, tallerId: TALLER_AJENO, usuarioId },
    });
    await matchingPrisma.match.create({
      data: {
        empresaId,
        estudianteId: usuarioId,
        capacitadorId: admin.id,
        tallerId: TALLER_AJENO,
        temaId: tema.id,
        score: 77,
        decision: 'INTERESADO',
      },
    });

    token = new JwtService({ secret: process.env.JWT_ACCESS_SECRET! }).sign({ sub: usuarioId });
  });

  afterAll(async () => {
    await limpiar();
    await gateway.close();
    await matchingApp.close();
    await learningApp.close();
    await identityApp.close();
  });

  const servidor = () => gateway.getHttpServer();

  it('junta en un archivo lo que guardan los tres servicios', async () => {
    const res = await request(servidor())
      .get('/datos/exportar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Se entrega como descarga: quien pide sus datos quiere el archivo, no mirarlo en pantalla.
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('mis-datos-enactiva.json');

    const exportacion = JSON.parse(res.text) as ExportacionDatos;
    expect(exportacion.usuarioId).toBe(usuarioId);
    expect(exportacion.servicios.map((parte) => parte.servicio)).toEqual([
      'identity-service',
      'learning-service',
      'matching-service',
    ]);

    const texto = res.text;
    expect(texto).toContain(EMAIL);
    expect(texto).toContain('Primeros auxilios');
    expect(texto).toContain('"score": 77');
    // El aviso va dentro del archivo: quien lo abre tiene que entender qué tiene en la mano.
    expect(exportacion.aviso).toMatch(/auditoría/);
  });

  it('no incluye el hash de la contraseña en ninguna de las tres partes', async () => {
    const res = await request(servidor())
      .get('/datos/exportar')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.text).not.toContain('passwordHash');
    expect(res.text).not.toContain('$argon');
  });

  it('suprime en las tres bases y cuenta lo que se fue en cada una', async () => {
    const res = await request(servidor())
      .delete('/datos/suprimir')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const resultado = res.body as ResultadoSupresion;
    // Que los tres hayan respondido es la prueba del orden: identity va al final porque, apenas
    // anonimiza la cuenta, la sesión muere y los otros dos responderían 401.
    expect(resultado.servicios.map((parte) => parte.servicio)).toEqual([
      'learning-service',
      'matching-service',
      'identity-service',
    ]);
    expect(resultado.servicios[0]!.borrado).toMatchObject({ inscripciones: 1 });
    expect(resultado.servicios[1]!.borrado).toMatchObject({ decisionesDelMazo: 1 });
    expect(resultado.servicios[2]!.borrado).toMatchObject({ cuenta: 1 });

    expect(await learningPrisma.inscripcion.count({ where: { usuarioId } })).toBe(0);
    expect(await matchingPrisma.match.count({ where: { estudianteId: usuarioId } })).toBe(0);
    const usuario = await identityPrisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario).toMatchObject({ email: null, nombre: null, estado: 'ANONIMIZADO' });
  });

  it('después de suprimir, la exportación ya no devuelve nada', async () => {
    await request(servidor())
      .delete('/datos/suprimir')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // La cuenta quedó ANONIMIZADO, así que ya no es una sesión activa en ningún servicio.
    await request(servidor())
      .get('/datos/exportar')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('si un servicio no responde, no se borra nada y la cuenta sigue en pie', async () => {
    const original = process.env.URL_LEARNING_SERVICE;
    process.env.URL_LEARNING_SERVICE = 'http://127.0.0.1:1';
    limpiarEnvGateway();

    try {
      const res = await request(servidor())
        .delete('/datos/suprimir')
        .set('Authorization', `Bearer ${token}`)
        .expect(502);
      expect((res.body as { mensaje: string }).mensaje).toMatch(/learning-service/);

      // learning es el primero de la cadena: si no contesta, la cuenta no se toca.
      const usuario = await identityPrisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
      expect(usuario.estado).toBe('ACTIVO');
      expect(usuario.email).toBe(EMAIL);
      expect(await matchingPrisma.match.count({ where: { estudianteId: usuarioId } })).toBe(1);
    } finally {
      process.env.URL_LEARNING_SERVICE = original;
      limpiarEnvGateway();
    }
  });

  it('sin token no se exporta ni se suprime', async () => {
    await request(servidor()).get('/datos/exportar').expect(401);
    await request(servidor()).delete('/datos/suprimir').expect(401);

    const usuario = await identityPrisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(usuario.estado).toBe('ACTIVO');
  });

  it('la frase de confirmación es parte del contrato, no del formulario', () => {
    // La web la exige antes de llamar a este endpoint; vive en shared para que el texto que se
    // escribe en pantalla y el que se documenta sean el mismo.
    expect(CONFIRMACION_SUPRESION).toBe('ELIMINAR MI CUENTA');
  });
});
