import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { TemaResumen } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, tokenDeId } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const MARCA = '(archivar temas e2e)';

/**
 * Quitar un tema del catálogo (SPEC §3.6, 2026-11-12).
 *
 * No se borra: de un tema cuelgan las declaraciones de la gente —con borrado en cascada— y los
 * talleres de learning_db, que lo referencian sin clave foránea. Estos tests fijan justamente
 * eso: que quitar no se lleve nada por delante.
 */
describe('Quitar un tema del catálogo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let empresaA: string;
  let empresaB: string;
  let rrhhA: string;
  let rrhhB: string;
  let aprendeA: string;

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: MARCA } },
      select: { id: true },
    });
    const ids = empresas.map((e) => e.id);
    if (ids.length === 0) return;
    await prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
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
    const unaEmpresa = async (nombre: string) =>
      (
        await prisma.empresa.create({
          data: { nombre: `${nombre} ${MARCA}`, rubro: 'Minería', creadaPorId: admin.id },
        })
      ).id;

    empresaA = await unaEmpresa('Planta Norte');
    empresaB = await unaEmpresa('Planta Sur');

    const persona = async (empresaId: string, sufijo: string, rol: 'RRHH' | 'ESTUDIANTE') =>
      (
        await prisma.usuario.create({
          data: {
            email: `${sufijo}.archivar@plataforma.local`,
            nombre: 'Persona',
            estado: 'ACTIVO',
            empresaId,
            roles: { create: { rol } },
          },
        })
      ).id;

    rrhhA = await persona(empresaA, 'rrhh-a', 'RRHH');
    rrhhB = await persona(empresaB, 'rrhh-b', 'RRHH');
    aprendeA = await persona(empresaA, 'aprende-a', 'ESTUDIANTE');
  });

  beforeEach(async () => {
    await prisma.perfilInteres.deleteMany({ where: { empresaId: { in: [empresaA, empresaB] } } });
    await prisma.tema.deleteMany({ where: { empresaId: { in: [empresaA, empresaB] } } });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const como = (usuarioId: string) => `Bearer ${tokenDeId(app, usuarioId)}`;

  const crearTema = async (usuarioId: string, nombre: string) => {
    const { body } = await request(app.getHttpServer())
      .post('/temas')
      .set('Authorization', como(usuarioId))
      .send({ nombre })
      .expect(201);
    return body as TemaResumen;
  };

  const quitar = (usuarioId: string, id: string) =>
    request(app.getHttpServer()).delete(`/temas/${id}`).set('Authorization', como(usuarioId));

  const catalogo = async (usuarioId: string) => {
    const { body } = await request(app.getHttpServer())
      .get('/temas')
      .set('Authorization', como(usuarioId))
      .expect(200);
    return (body as TemaResumen[]).map((t) => t.nombre);
  };

  const declarar = (usuarioId: string, temaId: string) =>
    request(app.getHttpServer())
      .post('/mi-perfil/intereses')
      .set('Authorization', como(usuarioId))
      .send({ temaId, tipo: 'APRENDER', dimensiones: ['HABILIDAD'], nivel: 'BASICO' });

  it('sale del catálogo', async () => {
    const tema = await crearTema(rrhhA, 'Excel avanzado');
    expect(await catalogo(rrhhA)).toContain('Excel avanzado');

    await quitar(rrhhA, tema.id).expect(204);

    expect(await catalogo(rrhhA)).not.toContain('Excel avanzado');
  });

  it('NO se borra: la fila sigue, solo queda archivada', async () => {
    const tema = await crearTema(rrhhA, 'Excel avanzado');

    await quitar(rrhhA, tema.id).expect(204);

    const guardado = await prisma.tema.findUniqueOrThrow({ where: { id: tema.id } });
    expect(guardado.archivadoAt).not.toBeNull();
  });

  it('las declaraciones que ya existían se quedan', async () => {
    // Es lo que de verdad importa: la relación tiene borrado en cascada, así que un DELETE se
    // habría llevado el perfil de esta persona sin decir nada.
    const tema = await crearTema(rrhhA, 'Excel avanzado');
    await declarar(aprendeA, tema.id).expect(201);

    await quitar(rrhhA, tema.id).expect(204);

    expect(await prisma.perfilInteres.count({ where: { temaId: tema.id } })).toBe(1);
  });

  it('un taller ya convocado sigue pudiendo resolver su nombre', async () => {
    // learning pregunta por `/interno/temas?ids=`, y ahí los archivados sí entran: si no, un
    // taller convocado sobre ese tema se quedaría sin nombre que mostrar.
    const tema = await crearTema(rrhhA, 'Excel avanzado');
    await quitar(rrhhA, tema.id).expect(204);

    const { body } = await request(app.getHttpServer())
      .get(`/interno/temas?ids=${tema.id}`)
      .set('Authorization', como(aprendeA))
      .expect(200);

    expect(body).toEqual([{ id: tema.id, nombre: 'Excel avanzado' }]);
  });

  it('ya no se puede declarar', async () => {
    const tema = await crearTema(rrhhA, 'Excel avanzado');
    await quitar(rrhhA, tema.id).expect(204);

    const { body } = await declarar(aprendeA, tema.id).expect(409);
    expect((body as { message: string }).message).toMatch(/ya no está en el catálogo/i);
  });

  it('volver a agregarlo con el mismo nombre lo trae de vuelta, con sus declaraciones', async () => {
    // El nombre normalizado es único por empresa: sin esto, el tema quedaría imposible de
    // recuperar y de recrear.
    const tema = await crearTema(rrhhA, 'Excel avanzado');
    await declarar(aprendeA, tema.id).expect(201);
    await quitar(rrhhA, tema.id).expect(204);

    const vuelto = await crearTema(rrhhA, 'EXCEL  Avanzado');

    expect(vuelto.id).toBe(tema.id);
    expect(vuelto.quierenAprender).toBe(1);
    expect(await catalogo(rrhhA)).toContain('Excel avanzado');
  });

  it('no se quita dos veces', async () => {
    const tema = await crearTema(rrhhA, 'Excel avanzado');
    await quitar(rrhhA, tema.id).expect(204);

    const { body } = await quitar(rrhhA, tema.id).expect(409);
    expect((body as { message: string }).message).toMatch(/ya está fuera del catálogo/i);
  });

  it('queda auditado, sin el nombre del tema', async () => {
    const tema = await crearTema(rrhhA, 'Excel avanzado');
    await quitar(rrhhA, tema.id).expect(204);

    const registros = await prisma.registroAuditoria.findMany({
      where: { entidad: 'Tema', entidadId: tema.id },
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(registros[0]!.camposModificados).toEqual(['archivadoAt']);
  });

  describe('aislamiento y permisos', () => {
    it('RRHH de otra empresa recibe 404 y no 403', async () => {
      const tema = await crearTema(rrhhA, 'Excel avanzado');

      // Un 403 confirmaría que ese tema existe en la otra empresa.
      await quitar(rrhhB, tema.id).expect(404);

      expect(
        (await prisma.tema.findUniqueOrThrow({ where: { id: tema.id } })).archivadoAt,
      ).toBeNull();
    });

    it('quien no administra el catálogo no quita nada', async () => {
      const tema = await crearTema(rrhhA, 'Excel avanzado');

      await quitar(aprendeA, tema.id).expect(403);
    });

    it('sin token, 401', async () => {
      const tema = await crearTema(rrhhA, 'Excel avanzado');
      await request(app.getHttpServer()).delete(`/temas/${tema.id}`).expect(401);
    });
  });
});
