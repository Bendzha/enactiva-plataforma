import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { participaEnLaRed, rolesCompatibles } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, tokenDeId } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const MARCA = '(solo administra e2e)';

/**
 * RRHH administra y no participa (2026-11-11).
 *
 * La separación tiene que vivir en el servidor y no solo en el menú: una pantalla que se alcanza
 * escribiendo la dirección a mano no está separada de nada.
 */
describe('RRHH administra y no participa (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let empresaId: string;
  let rrhh: string;
  let aprende: string;
  let adminEnactiva: string;
  let temaId: string;

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
    adminEnactiva = admin.id;

    const empresa = await prisma.empresa.create({
      data: { nombre: `Planta ${MARCA}`, rubro: 'Minería', creadaPorId: admin.id },
    });
    empresaId = empresa.id;

    const persona = async (sufijo: string, rol: 'RRHH' | 'ESTUDIANTE') =>
      (
        await prisma.usuario.create({
          data: {
            email: `${sufijo}.administra@plataforma.local`,
            nombre: 'Persona',
            estado: 'ACTIVO',
            empresaId,
            roles: { create: { rol } },
          },
        })
      ).id;

    rrhh = await persona('rrhh', 'RRHH');
    aprende = await persona('aprende', 'ESTUDIANTE');

    const tema = await prisma.tema.create({
      data: { empresaId, nombre: 'Excel avanzado', nombreNormalizado: 'excel avanzado' },
    });
    temaId = tema.id;
  });

  beforeEach(async () => {
    await prisma.solicitud.deleteMany({ where: { empresaId } });
    await prisma.perfilInteres.deleteMany({ where: { empresaId } });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const como = (usuarioId: string) => `Bearer ${tokenDeId(app, usuarioId)}`;

  describe('la regla, como función pura', () => {
    it('participa quien enseña y quien aprende; no RRHH ni ENACTIVA', () => {
      expect(participaEnLaRed(['ESTUDIANTE'])).toBe(true);
      expect(participaEnLaRed(['CAPACITADOR', 'ESTUDIANTE'])).toBe(true);
      expect(participaEnLaRed(['RRHH'])).toBe(false);
      expect(participaEnLaRed(['ADMIN_ENACTIVA'])).toBe(false);
    });

    it('el rol RRHH es excluyente', () => {
      expect(rolesCompatibles(['RRHH'])).toBe(true);
      expect(rolesCompatibles(['CAPACITADOR', 'ESTUDIANTE'])).toBe(true);
      expect(rolesCompatibles(['RRHH', 'ESTUDIANTE'])).toBe(false);
      expect(rolesCompatibles(['RRHH', 'CAPACITADOR'])).toBe(false);
    });
  });

  describe('lo que RRHH no puede hacer', () => {
    it('no tiene perfil corporativo', async () => {
      await request(app.getHttpServer())
        .get('/mi-perfil')
        .set('Authorization', como(rrhh))
        .expect(403);
    });

    it('no declara lo que sabe ni lo que quiere aprender', async () => {
      await request(app.getHttpServer())
        .post('/mi-perfil/intereses')
        .set('Authorization', como(rrhh))
        .send({ temaId, tipo: 'ENSENAR', dimensiones: ['HABILIDAD'], nivel: 'AVANZADO' })
        .expect(403);

      expect(await prisma.perfilInteres.count({ where: { usuarioId: rrhh } })).toBe(0);
    });

    it('no puede pedir el rol de quien enseña: el rol RRHH es excluyente', async () => {
      await request(app.getHttpServer())
        .post('/solicitudes/quiero-ensenar')
        .set('Authorization', como(rrhh))
        .send({ detalle: 'Quiero enseñar Excel.' })
        .expect(403);

      expect(await prisma.solicitud.count({ where: { solicitanteId: rrhh } })).toBe(0);
    });

    it('no puede borrar su cuenta: su organización se quedaría sin quien la administre', async () => {
      const { body } = await request(app.getHttpServer())
        .delete('/interno/datos-personales')
        .set('Authorization', como(rrhh))
        .expect(403);

      expect((body as { message: string }).message).toMatch(/no se suprime desde aquí/i);
      expect(
        await prisma.usuario.findUniqueOrThrow({ where: { id: rrhh }, select: { email: true } }),
      ).toMatchObject({ email: 'rrhh.administra@plataforma.local' });
    });

    it('pero sí puede exportar los suyos: eso la ley se lo garantiza a cualquiera', async () => {
      await request(app.getHttpServer())
        .get('/interno/datos-personales')
        .set('Authorization', como(rrhh))
        .expect(200);
    });

    it('el equipo de ENACTIVA tampoco participa', async () => {
      await request(app.getHttpServer())
        .get('/mi-perfil')
        .set('Authorization', como(adminEnactiva))
        .expect(403);
    });
  });

  describe('lo que RRHH sí sigue pudiendo hacer', () => {
    it('ve el catálogo de temas de su empresa', async () => {
      await request(app.getHttpServer()).get('/temas').set('Authorization', como(rrhh)).expect(200);
    });

    it('agrega temas al catálogo', async () => {
      await request(app.getHttpServer())
        .post('/temas')
        .set('Authorization', como(rrhh))
        .send({ nombre: 'Primeros auxilios' })
        .expect(201);
    });

    it('ve la bandeja de solicitudes y las resuelve', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/solicitudes/quiero-ensenar')
        .set('Authorization', como(aprende))
        .send({ detalle: 'Quiero enseñar.' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/solicitudes/${(body as { id: string }).id}/aprobar`)
        .set('Authorization', como(rrhh))
        .expect(200);
    });

    it('ve las métricas de su empresa', async () => {
      await request(app.getHttpServer())
        .get('/metricas/intereses')
        .set('Authorization', como(rrhh))
        .expect(200);
    });

    it('personaliza el entorno de su empresa', async () => {
      await request(app.getHttpServer())
        .get('/mi-empresa/personalizacion')
        .set('Authorization', como(rrhh))
        .expect(200);
    });
  });

  describe('las métricas no la cuentan como persona', () => {
    it('el total de personas deja fuera a quien administra', async () => {
      // Con RRHH dentro del total, «N de M con perfil» tendría un techo que nunca se alcanza y
      // se leería como que falta alguien por completarlo.
      const { body } = await request(app.getHttpServer())
        .get('/metricas/intereses')
        .set('Authorization', como(rrhh))
        .expect(200);

      const activas = await prisma.usuario.count({ where: { empresaId, estado: 'ACTIVO' } });
      expect(activas).toBe(2);
      expect((body as { personasActivas: number }).personasActivas).toBe(1);
    });
  });
});
