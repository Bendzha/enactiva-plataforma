import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, serializar, tokenDeId } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const MARCA = '(solicitudes e2e)';

describe('Solicitudes a RRHH (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let empresaA: string;
  let empresaB: string;
  let rrhhA: string;
  let rrhhB: string;
  let ensenaA: string;
  let aprendeA: string;

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: MARCA } },
      select: { id: true },
    });
    const ids = empresas.map((e) => e.id);
    if (ids.length === 0) return;
    await prisma.solicitud.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
  };

  const crearPersona = async (
    empresaId: string,
    sufijo: string,
    roles: ('RRHH' | 'CAPACITADOR' | 'ESTUDIANTE')[],
  ) => {
    const usuario = await prisma.usuario.create({
      data: {
        email: `${sufijo}.solicitudes@plataforma.local`,
        nombre: 'Persona',
        apellido: sufijo,
        estado: 'ACTIVO',
        empresaId,
        roles: { create: roles.map((rol) => ({ rol })) },
      },
    });
    return usuario.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerStorage)
      .useValue(ALMACEN_SIN_LIMITE)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await limpiar();

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    const unaEmpresa = async (nombre: string) => {
      const empresa = await prisma.empresa.create({
        data: { nombre: `${nombre} ${MARCA}`, rubro: 'Minería', creadaPorId: admin.id },
      });
      return empresa.id;
    };

    empresaA = await unaEmpresa('Planta Norte');
    empresaB = await unaEmpresa('Planta Sur');

    rrhhA = await crearPersona(empresaA, 'rrhh-a', ['RRHH']);
    rrhhB = await crearPersona(empresaB, 'rrhh-b', ['RRHH']);
    ensenaA = await crearPersona(empresaA, 'ensena-a', ['CAPACITADOR', 'ESTUDIANTE']);
    aprendeA = await crearPersona(empresaA, 'aprende-a', ['ESTUDIANTE']);
  });

  beforeEach(async () => {
    await prisma.solicitud.deleteMany({ where: { empresaId: { in: [empresaA, empresaB] } } });
    await prisma.usuarioRol.deleteMany({ where: { usuarioId: aprendeA, rol: 'CAPACITADOR' } });
    await prisma.perfilInteres.deleteMany({ where: { empresaId: empresaA } });
    await prisma.tema.deleteMany({ where: { empresaId: empresaA } });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const como = (usuarioId: string) => `Bearer ${tokenDeId(app, usuarioId)}`;

  const proponer = (
    usuarioId: string,
    tema: string,
    detalle = 'Lo hago hace años.',
    extra: Record<string, unknown> = {},
  ) =>
    request(app.getHttpServer())
      .post('/solicitudes/propuesta-de-taller')
      .set('Authorization', como(usuarioId))
      .send({
        tema,
        detalle,
        tipoInteres: 'ENSENAR',
        dimensiones: ['HABILIDAD'],
        nivel: 'AVANZADO',
        ...extra,
      });

  const pedirRol = (usuarioId: string, detalle = 'Quiero enseñar soldadura.') =>
    request(app.getHttpServer())
      .post('/solicitudes/quiero-ensenar')
      .set('Authorization', como(usuarioId))
      .send({ detalle });

  const bandeja = (usuarioId: string) =>
    request(app.getHttpServer()).get('/solicitudes').set('Authorization', como(usuarioId));

  const aprobar = (usuarioId: string, id: string) =>
    request(app.getHttpServer())
      .patch(`/solicitudes/${id}/aprobar`)
      .set('Authorization', como(usuarioId));

  const rechazar = (usuarioId: string, id: string, motivo?: string) =>
    request(app.getHttpServer())
      .patch(`/solicitudes/${id}/rechazar`)
      .set('Authorization', como(usuarioId))
      .send(motivo === undefined ? {} : { motivo });

  describe('proponer un taller', () => {
    it('queda pendiente y la ve quien la pidió', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);

      expect(body).toMatchObject({
        tipo: 'PROPUESTA_TALLER',
        estado: 'PENDIENTE',
        tema: 'Soldadura TIG',
        motivoRechazo: null,
        resueltaAt: null,
      });

      const { body: mias } = await request(app.getHttpServer())
        .get('/solicitudes/mias')
        .set('Authorization', como(ensenaA))
        .expect(200);
      expect(mias).toHaveLength(1);
    });

    it('si el tema ya está en el catálogo, no hay nada que pedir', async () => {
      await prisma.tema.create({
        data: {
          empresaId: empresaA,
          nombre: 'Excel avanzado',
          nombreNormalizado: 'excel avanzado',
        },
      });

      const { body } = await proponer(ensenaA, 'EXCEL  Avanzado').expect(409);

      // El nombre normalizado es el que decide: "EXCEL  Avanzado" y "Excel avanzado" son el mismo.
      expect((body as { message: string }).message).toMatch(/ya está en el catálogo/i);
      expect(await prisma.solicitud.count({ where: { empresaId: empresaA } })).toBe(0);
    });

    it('la misma persona no propone dos veces el mismo tema', async () => {
      await proponer(ensenaA, 'Soldadura TIG').expect(201);
      await proponer(ensenaA, 'soldadura  tig').expect(409);

      expect(await prisma.solicitud.count({ where: { solicitanteId: ensenaA } })).toBe(1);
    });

    it('pero sí puede proponer otro tema: dos ideas no son spam', async () => {
      await proponer(ensenaA, 'Soldadura TIG').expect(201);
      await proponer(ensenaA, 'Primeros auxilios').expect(201);

      expect(await prisma.solicitud.count({ where: { solicitanteId: ensenaA } })).toBe(2);
    });

    it('quien solo aprende también puede proponer un tema que echa de menos', async () => {
      await proponer(aprendeA, 'Hablar en público').expect(201);
    });

    it('resuelta la anterior, puede volver a proponer el mismo tema', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      await rechazar(rrhhA, (body as { id: string }).id).expect(200);

      await proponer(ensenaA, 'Soldadura TIG').expect(201);
    });
  });

  describe('pedir el rol de quien enseña', () => {
    it('queda pendiente y no otorga nada por sí sola', async () => {
      await pedirRol(aprendeA).expect(201);

      const roles = await prisma.usuarioRol.findMany({ where: { usuarioId: aprendeA } });
      expect(roles.map((r) => r.rol)).not.toContain('CAPACITADOR');
    });

    it('quien ya puede enseñar no lo pide', async () => {
      const { body } = await pedirRol(ensenaA).expect(409);
      expect((body as { message: string }).message).toMatch(/ya puedes enseñar/i);
    });

    it('una sola pendiente a la vez', async () => {
      await pedirRol(aprendeA).expect(201);
      await pedirRol(aprendeA).expect(409);

      expect(await prisma.solicitud.count({ where: { solicitanteId: aprendeA } })).toBe(1);
    });

    it('no lleva tema: no es una propuesta de taller', async () => {
      const { body } = await pedirRol(aprendeA).expect(201);
      expect((body as { tema: string | null }).tema).toBeNull();
    });
  });

  describe('RRHH resuelve', () => {
    it('aprobar una propuesta crea el tema en el catálogo', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);

      const { body: aprobada } = await aprobar(rrhhA, (body as { id: string }).id).expect(200);

      expect(aprobada).toMatchObject({ estado: 'APROBADA' });
      expect((aprobada as { resueltaAt: string }).resueltaAt).not.toBeNull();

      const tema = await prisma.tema.findFirstOrThrow({ where: { empresaId: empresaA } });
      expect(tema.nombre).toBe('Soldadura TIG');
      expect(tema.nombreNormalizado).toBe('soldadura tig');
      // Queda a nombre de quien aprobó: el catálogo es de RRHH.
      expect(tema.creadoPorId).toBe(rrhhA);
    });

    it('y deja declarado a quien propuso, con lo que esa persona eligió', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG', 'Hace años.', {
        dimensiones: ['HABILIDAD', 'CONTENIDO'],
        nivel: 'AVANZADO',
      }).expect(201);

      await aprobar(rrhhA, (body as { id: string }).id).expect(200);

      const declaracion = await prisma.perfilInteres.findFirstOrThrow({
        where: { usuarioId: ensenaA },
      });
      expect(declaracion.tipo).toBe('ENSENAR');
      expect(declaracion.nivel).toBe('AVANZADO');
      expect(declaracion.dimensiones).toEqual(['HABILIDAD', 'CONTENIDO']);
    });

    it('quien pidió el taller desde «quiero aprender» queda declarado así', async () => {
      const { body } = await proponer(aprendeA, 'Hablar en público', 'Me cuesta.', {
        tipoInteres: 'APRENDER',
        nivel: 'BASICO',
      }).expect(201);

      await aprobar(rrhhA, (body as { id: string }).id).expect(200);

      const declaracion = await prisma.perfilInteres.findFirstOrThrow({
        where: { usuarioId: aprendeA },
      });
      expect(declaracion.tipo).toBe('APRENDER');
      expect(declaracion.nivel).toBe('BASICO');
    });

    it('el taller NO se crea: eso lo hace RRHH a mano', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      await aprobar(rrhhA, (body as { id: string }).id).expect(200);

      // learning_db es de otro servicio y aprobar no la toca. Lo que se crea acá es el tema.
      const aprobadas = await prisma.solicitud.count({
        where: { empresaId: empresaA, estado: 'APROBADA' },
      });
      expect(aprobadas).toBe(1);
    });

    it('si alguien creó el tema entremedio, se reusa en vez de fallar', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      await prisma.tema.create({
        data: { empresaId: empresaA, nombre: 'Soldadura TIG', nombreNormalizado: 'soldadura tig' },
      });

      await aprobar(rrhhA, (body as { id: string }).id).expect(200);

      expect(await prisma.tema.count({ where: { empresaId: empresaA } })).toBe(1);
      expect(await prisma.perfilInteres.count({ where: { usuarioId: ensenaA } })).toBe(1);
    });

    it('rechazar no crea nada', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);

      await rechazar(rrhhA, (body as { id: string }).id, 'No da para un taller.').expect(200);

      expect(await prisma.tema.count({ where: { empresaId: empresaA } })).toBe(0);
      expect(await prisma.perfilInteres.count({ where: { usuarioId: ensenaA } })).toBe(0);
    });

    it('aprobar un cambio de rol sí otorga el rol', async () => {
      const { body } = await pedirRol(aprendeA).expect(201);

      await aprobar(rrhhA, (body as { id: string }).id).expect(200);

      const roles = await prisma.usuarioRol.findMany({ where: { usuarioId: aprendeA } });
      expect(roles.map((r) => r.rol)).toContain('CAPACITADOR');
    });

    it('rechazar sin motivo funciona: la clienta dijo «con motivo o sin motivo»', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);

      const { body: rechazada } = await rechazar(rrhhA, (body as { id: string }).id).expect(200);

      expect(rechazada).toMatchObject({ estado: 'RECHAZADA', motivoRechazo: null });
    });

    it('el motivo del rechazo lo ve quien la pidió', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      await rechazar(rrhhA, (body as { id: string }).id, 'Ya hay un taller parecido en marzo.');

      const { body: mias } = await request(app.getHttpServer())
        .get('/solicitudes/mias')
        .set('Authorization', como(ensenaA))
        .expect(200);

      expect((mias as { motivoRechazo: string }[])[0]!.motivoRechazo).toBe(
        'Ya hay un taller parecido en marzo.',
      );
    });

    it('una solicitud ya resuelta no se vuelve a resolver', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      const id = (body as { id: string }).id;

      await aprobar(rrhhA, id).expect(200);
      await rechazar(rrhhA, id).expect(409);
      await aprobar(rrhhA, id).expect(409);
    });

    it('la bandeja muestra las pendientes primero, con quién pidió', async () => {
      const { body } = await proponer(ensenaA, 'Resuelta').expect(201);
      await aprobar(rrhhA, (body as { id: string }).id).expect(200);
      await proponer(ensenaA, 'Pendiente').expect(201);

      const { body: lista } = await bandeja(rrhhA).expect(200);

      const estados = (lista as { estado: string }[]).map((s) => s.estado);
      expect(estados[0]).toBe('PENDIENTE');
      expect((lista as { solicitante: { apellido: string } }[])[0]!.solicitante.apellido).toBe(
        'ensena-a',
      );
    });
  });

  describe('aislamiento y permisos', () => {
    it('RRHH de otra empresa no ve la bandeja de esta', async () => {
      await proponer(ensenaA, 'Soldadura TIG').expect(201);

      const { body } = await bandeja(rrhhB).expect(200);
      expect(body).toEqual([]);
    });

    it('resolver una solicitud de otra empresa responde 404 y no 403', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      const id = (body as { id: string }).id;

      // Un 403 confirmaría que esa solicitud existe, y con ella que alguien de otra empresa
      // pidió algo. El 404 no dice nada.
      await aprobar(rrhhB, id).expect(404);
      await rechazar(rrhhB, id).expect(404);

      expect(await prisma.solicitud.findUniqueOrThrow({ where: { id } })).toMatchObject({
        estado: 'PENDIENTE',
      });
    });

    it('quien no es RRHH no resuelve ni ve la bandeja', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      const id = (body as { id: string }).id;

      await bandeja(ensenaA).expect(403);
      await aprobar(ensenaA, id).expect(403);
      await rechazar(ensenaA, id).expect(403);
    });

    it('nadie aprueba su propia solicitud sin ser RRHH, ni ve las de otros en «mias»', async () => {
      await proponer(ensenaA, 'Soldadura TIG').expect(201);

      const { body: mias } = await request(app.getHttpServer())
        .get('/solicitudes/mias')
        .set('Authorization', como(aprendeA))
        .expect(200);

      expect(mias).toEqual([]);
    });

    it('sin token, 401', async () => {
      await request(app.getHttpServer()).get('/solicitudes/mias').expect(401);
      await request(app.getHttpServer())
        .post('/solicitudes/propuesta-de-taller')
        .send({ tema: 'Soldadura' })
        .expect(401);
    });
  });

  describe('auditoría y validación', () => {
    it('queda registrada sin el texto que escribió la persona', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG', 'Trabajé 10 años en la maestranza');
      const id = (body as { id: string }).id;
      await aprobar(rrhhA, id).expect(200);

      const registros = await prisma.registroAuditoria.findMany({
        where: { entidad: 'Solicitud', entidadId: id },
        orderBy: { id: 'asc' },
      });

      expect(registros.map((r) => r.accion)).toEqual(['CREAR', 'ACTUALIZAR']);
      expect(serializar(registros)).not.toContain('maestranza');
      expect(serializar(registros)).not.toContain('Soldadura TIG');
    });

    it('un tema vacío o larguísimo no entra', async () => {
      await proponer(ensenaA, 'x').expect(400);
      await proponer(ensenaA, 'x'.repeat(200)).expect(400);
    });

    it('sin dimensiones no entra: al aprobar habría que inventarlas', async () => {
      await proponer(ensenaA, 'Soldadura TIG', 'Hace años.', { dimensiones: [] }).expect(400);
    });

    it('un motivo larguísimo no entra', async () => {
      const { body } = await proponer(ensenaA, 'Soldadura TIG').expect(201);
      await rechazar(rrhhA, (body as { id: string }).id, 'x'.repeat(500)).expect(400);
    });
  });
});
