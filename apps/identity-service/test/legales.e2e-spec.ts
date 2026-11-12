import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { documentosPendientes, VERSIONES_LEGALES, type EstadoAceptaciones } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, serializar, tokenDeId } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const MARCA = '(legales e2e)';

/**
 * Los dos documentos y la re-aceptación (SPEC §3.7, Q21).
 *
 * Lo que fija esta suite: que sean **dos** registros distintos, que subir una versión obligue a
 * volver a aceptar, y que la versión la ponga el servidor y no quien pide.
 */
describe('Aceptación de los documentos legales (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let empresaId: string;
  let persona: string;

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
    const empresa = await prisma.empresa.create({
      data: { nombre: `Planta ${MARCA}`, rubro: 'Minería', creadaPorId: admin.id },
    });
    empresaId = empresa.id;
  });

  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: 'legales@plataforma.local' } });
    const usuario = await prisma.usuario.create({
      data: {
        email: 'legales@plataforma.local',
        nombre: 'Persona',
        estado: 'ACTIVO',
        empresaId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
    persona = usuario.id;
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const como = () => `Bearer ${tokenDeId(app, persona)}`;
  const RUTA = '/mis-aceptaciones';

  const estado = async (): Promise<EstadoAceptaciones> => {
    const { body } = await request(app.getHttpServer())
      .get(RUTA)
      .set('Authorization', como())
      .expect(200);
    return body as EstadoAceptaciones;
  };

  const aceptar = (documentos: string[]) =>
    request(app.getHttpServer()).post(RUTA).set('Authorization', como()).send({ documentos });

  const yaAcepto = (documento: 'AVISO_PRIVACIDAD' | 'TERMINOS', version: string) =>
    prisma.aceptacionAviso.create({ data: { usuarioId: persona, documento, version } });

  describe('la regla, como función pura', () => {
    it('sin aceptar nada, los dos están pendientes', () => {
      expect(documentosPendientes([])).toEqual(['AVISO_PRIVACIDAD', 'TERMINOS']);
    });

    it('una versión vieja no cuenta como aceptada', () => {
      const aceptadas = [
        { documento: 'AVISO_PRIVACIDAD' as const, version: 'una-vieja' },
        { documento: 'TERMINOS' as const, version: VERSIONES_LEGALES.TERMINOS },
      ];
      expect(documentosPendientes(aceptadas)).toEqual(['AVISO_PRIVACIDAD']);
    });
  });

  it('quien no aceptó nada tiene los dos pendientes', async () => {
    expect((await estado()).pendientes).toEqual(['AVISO_PRIVACIDAD', 'TERMINOS']);
  });

  it('aceptar deja de pendiente solo lo aceptado: son dos documentos, no uno', async () => {
    await aceptar(['TERMINOS']).expect(201);

    const despues = await estado();
    expect(despues.pendientes).toEqual(['AVISO_PRIVACIDAD']);
    expect(despues.aceptadas).toHaveLength(1);
  });

  it('se guarda qué documento y en qué versión', async () => {
    await aceptar(['AVISO_PRIVACIDAD', 'TERMINOS']).expect(201);

    const filas = await prisma.aceptacionAviso.findMany({ where: { usuarioId: persona } });
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => `${f.documento}:${f.version}`).sort()).toEqual([
      `AVISO_PRIVACIDAD:${VERSIONES_LEGALES.AVISO_PRIVACIDAD}`,
      `TERMINOS:${VERSIONES_LEGALES.TERMINOS}`,
    ]);
  });

  it('subir la versión del texto obliga a aceptarlo de nuevo', async () => {
    // Esto es lo que antes no pasaba: el aviso se aceptaba al activar la cuenta y una versión
    // nueva no se la mostraba a nadie.
    await yaAcepto('AVISO_PRIVACIDAD', '2026-10-borrador');
    await yaAcepto('TERMINOS', VERSIONES_LEGALES.TERMINOS);

    expect((await estado()).pendientes).toEqual(['AVISO_PRIVACIDAD']);
  });

  it('la versión la pone el servidor, no quien pide', async () => {
    // Si viniera en la petición, cualquiera podría decir que aceptó una versión que no leyó.
    await request(app.getHttpServer())
      .post(RUTA)
      .set('Authorization', como())
      .send({ documentos: ['TERMINOS'], version: 'la-que-yo-quiera' })
      .expect(201);

    const fila = await prisma.aceptacionAviso.findFirstOrThrow({
      where: { usuarioId: persona, documento: 'TERMINOS' },
    });
    expect(fila.version).toBe(VERSIONES_LEGALES.TERMINOS);
  });

  it('aceptar dos veces lo mismo no agrega una fila', async () => {
    await aceptar(['TERMINOS']).expect(201);
    await aceptar(['TERMINOS']).expect(409);

    expect(await prisma.aceptacionAviso.count({ where: { usuarioId: persona } })).toBe(1);
  });

  it('la aceptación queda auditada, sin el texto', async () => {
    await aceptar(['AVISO_PRIVACIDAD']).expect(201);

    const registros = await prisma.registroAuditoria.findMany({
      where: { entidad: 'AceptacionAviso', entidadId: persona },
      orderBy: { id: 'desc' },
      take: 1,
    });
    expect(registros[0]!.camposModificados).toEqual(['documento.AVISO_PRIVACIDAD']);
    expect(serializar(registros)).not.toContain('Ley 21.719');
  });

  it('un documento inventado no entra', async () => {
    await aceptar(['LO_QUE_SEA']).expect(400);
    await aceptar([]).expect(400);
  });

  it('sin token, 401', async () => {
    await request(app.getHttpServer()).get(RUTA).expect(401);
    await request(app.getHttpServer())
      .post(RUTA)
      .send({ documentos: ['TERMINOS'] })
      .expect(401);
  });

  it('nadie ve ni acepta por otra persona: sale del token', async () => {
    await aceptar(['TERMINOS']).expect(201);

    const otra = await prisma.usuario.create({
      data: {
        email: `otra.legales@plataforma.local`,
        estado: 'ACTIVO',
        empresaId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });

    const { body } = await request(app.getHttpServer())
      .get(RUTA)
      .set('Authorization', `Bearer ${tokenDeId(app, otra.id)}`)
      .expect(200);

    expect((body as EstadoAceptaciones).aceptadas).toEqual([]);
    await prisma.usuario.delete({ where: { id: otra.id } });
  });
});
