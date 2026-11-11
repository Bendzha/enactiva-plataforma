import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { PALETA_POR_OMISION } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, serializar, tokenDeId } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const MARCA = '(personalizacion e2e)';
const LOGO = `data:image/png;base64,${'A'.repeat(60)}=`;

const PALETA = { marca: '#7A0030', acento: '#30C8A0', fondo: '#FFFBF5', texto: '#1A1A1A' };

describe('Personalización por empresa (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let empresaA: string;
  let empresaB: string;
  let rrhhA: string;
  let rrhhB: string;
  let personaA: string;
  let adminEnactiva: string;

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
    adminEnactiva = admin.id;

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
            email: `${sufijo}.personalizacion@plataforma.local`,
            nombre: 'Persona',
            estado: 'ACTIVO',
            empresaId,
            roles: { create: { rol } },
          },
        })
      ).id;

    rrhhA = await persona(empresaA, 'rrhh-a', 'RRHH');
    rrhhB = await persona(empresaB, 'rrhh-b', 'RRHH');
    personaA = await persona(empresaA, 'persona-a', 'ESTUDIANTE');
  });

  beforeEach(async () => {
    await prisma.empresa.updateMany({
      where: { id: { in: [empresaA, empresaB] } },
      data: { colorMarca: null, colorAcento: null, colorFondo: null, colorTexto: null, logo: null },
    });
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const como = (usuarioId: string) => `Bearer ${tokenDeId(app, usuarioId)}`;
  const RUTA = '/mi-empresa/personalizacion';

  const leer = (usuarioId: string) =>
    request(app.getHttpServer()).get(RUTA).set('Authorization', como(usuarioId));

  const guardar = (usuarioId: string, cuerpo: object) =>
    request(app.getHttpServer()).put(RUTA).set('Authorization', como(usuarioId)).send(cuerpo);

  const restablecer = (usuarioId: string) =>
    request(app.getHttpServer()).delete(RUTA).set('Authorization', como(usuarioId));

  describe('sin personalizar', () => {
    it('devuelve colores en null: la plantilla no es un estado incompleto', async () => {
      const { body } = await leer(rrhhA).expect(200);

      expect(body).toMatchObject({ colores: null, logo: null });
      expect((body as { empresaNombre: string }).empresaNombre).toContain('Planta Norte');
    });
  });

  describe('guardar', () => {
    it('RRHH pone los colores y el logo de su empresa', async () => {
      const { body } = await guardar(rrhhA, { colores: PALETA, logo: LOGO }).expect(200);

      expect(body).toMatchObject({ colores: PALETA, logo: LOGO });
    });

    it('cualquiera de la empresa los lee: es lo que pinta su pantalla', async () => {
      await guardar(rrhhA, { colores: PALETA, logo: null }).expect(200);

      const { body } = await leer(personaA).expect(200);
      expect((body as { colores: typeof PALETA }).colores).toEqual(PALETA);
    });

    it('se pueden poner colores sin logo', async () => {
      const { body } = await guardar(rrhhA, { colores: PALETA }).expect(200);
      expect((body as { logo: string | null }).logo).toBeNull();
    });

    it('un color que no es hexadecimal no entra: de ahí sale una variable CSS', async () => {
      for (const malo of ['rojo', '#FFF', 'var(--x)', '#00347A; background:url(x)']) {
        await guardar(rrhhA, { colores: { ...PALETA, marca: malo }, logo: null }).expect(400);
      }
    });

    it('un logo que no es una imagen propia no entra', async () => {
      for (const malo of [
        'https://otra-empresa.cl/logo.png',
        'data:text/html;base64,PHNjcmlwdD4=',
        'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      ]) {
        await guardar(rrhhA, { colores: PALETA, logo: malo }).expect(400);
      }
    });

    it('un contraste ilegible SÍ se guarda: la clienta dijo que lo ven ellos', async () => {
      const ilegible = { marca: '#FFFFFF', acento: '#FFFFFF', fondo: '#FFFFFF', texto: '#FFFFFF' };

      const { body } = await guardar(rrhhA, { colores: ilegible, logo: null }).expect(200);
      expect((body as { colores: typeof ilegible }).colores).toEqual(ilegible);
    });
  });

  describe('volver a la plantilla', () => {
    it('deja todo en null otra vez', async () => {
      await guardar(rrhhA, { colores: PALETA, logo: LOGO }).expect(200);

      const { body } = await restablecer(rrhhA).expect(200);
      expect(body).toMatchObject({ colores: null, logo: null });
    });
  });

  describe('aislamiento', () => {
    it('personalizar una empresa no toca a la otra', async () => {
      await guardar(rrhhA, { colores: PALETA, logo: LOGO }).expect(200);

      const { body } = await leer(rrhhB).expect(200);
      expect(body).toMatchObject({ colores: null, logo: null });
    });

    it('RRHH no puede repintar otra empresa: la suya sale de la sesión, no de la URL', async () => {
      await guardar(rrhhB, { colores: PALETA, logo: null }).expect(200);

      const deA = await prisma.empresa.findUniqueOrThrow({ where: { id: empresaA } });
      expect(deA.colorMarca).toBeNull();
    });

    it('quien no es RRHH no la cambia, aunque sí la lea', async () => {
      await leer(personaA).expect(200);
      await guardar(personaA, { colores: PALETA, logo: null }).expect(403);
      await restablecer(personaA).expect(403);
    });

    it('el equipo de ENACTIVA no personaliza: no pertenece a ninguna empresa', async () => {
      // Sus pantallas tienen que verse igual mirando a cualquier empresa (ADR-0011).
      await leer(adminEnactiva).expect(403);
      await guardar(adminEnactiva, { colores: PALETA, logo: null }).expect(403);
    });

    it('sin token, 401', async () => {
      await request(app.getHttpServer()).get(RUTA).expect(401);
      await request(app.getHttpServer()).put(RUTA).send({ colores: PALETA }).expect(401);
    });
  });

  describe('auditoría', () => {
    it('queda registrada sin guardar los colores ni el logo', async () => {
      await guardar(rrhhA, { colores: PALETA, logo: LOGO }).expect(200);

      const registros = await prisma.registroAuditoria.findMany({
        where: { entidad: 'Empresa', entidadId: empresaA },
        orderBy: { id: 'desc' },
        take: 1,
      });

      expect(registros[0]!.camposModificados).toContain('color.marca');
      expect(registros[0]!.camposModificados).toContain('logo');
      expect(serializar(registros)).not.toContain(PALETA.marca);
      expect(serializar(registros)).not.toContain(LOGO);
    });
  });

  describe('la paleta por omisión', () => {
    it('es la que el CSS trae escrita: si no, una empresa sin personalizar vería otra cosa', () => {
      expect(PALETA_POR_OMISION.marca).toBe('#00347A');
      expect(PALETA_POR_OMISION.acento).toBe('#FFB627');
    });
  });
});
