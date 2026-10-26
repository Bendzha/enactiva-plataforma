import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { DatosDeServicio, SupresionDeServicio } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ALMACEN_SIN_LIMITE, serializar, tokenDe } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_PRUEBA = 'clave-de-prueba-larga';
const EMAIL_ESTUDIANTE = 'estudiante.datos@plataforma.local';
const EMAIL_OTRO = 'otro.datos@plataforma.local';
const RUTA = '/interno/datos-personales';

describe('Exportar y suprimir datos personales en identity (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let empresaId: string;
  let areaId: string;
  let estudianteId: string;
  let temaId: string;

  const limpiar = async () => {
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(datos e2e)' } },
      select: { id: true },
    });
    const ids = empresas.map((empresa) => empresa.id);
    await prisma.usuario.deleteMany({ where: { empresaId: { in: ids } } });
    await prisma.empresa.deleteMany({ where: { id: { in: ids } } });
  };

  /** Deja a una persona con algo en cada tabla que la exportación tiene que mostrar. */
  const crearEstudiante = async (email: string) => {
    const usuario = await prisma.usuario.create({
      data: {
        email,
        passwordHash: await hashPassword(PASSWORD_PRUEBA),
        nombre: 'Camila',
        apellido: 'Reyes',
        cargo: 'Operadora',
        estado: 'ACTIVO',
        empresaId,
        areaId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });

    await prisma.perfilCorporativo.create({
      data: { usuarioId: usuario.id, empresaId, interesesGenerales: 'Quiero aprender Excel' },
    });
    await prisma.perfilInteres.create({
      data: {
        empresaId,
        usuarioId: usuario.id,
        temaId,
        tipo: 'APRENDER',
        dimensiones: ['CONTENIDO', 'HABILIDAD'],
        nivel: 'BASICO',
      },
    });
    await prisma.aceptacionAviso.create({
      data: { usuarioId: usuario.id, versionAviso: '2026-01', ip: '10.0.0.1' },
    });
    await prisma.tokenAcceso.create({
      data: {
        usuarioId: usuario.id,
        tipo: 'REFRESH',
        tokenHash: `hash-de-prueba-${usuario.id}`,
        expiraAt: new Date(Date.now() + 86_400_000),
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
    const empresa = await prisma.empresa.create({
      data: { nombre: 'Planta Norte (datos e2e)', rubro: 'Minería', creadaPorId: admin.id },
    });
    empresaId = empresa.id;

    const area = await prisma.area.create({
      data: { empresaId, nombre: 'Operaciones', nombreNormalizado: 'operaciones' },
    });
    areaId = area.id;
  });

  beforeEach(async () => {
    // Cada test parte con la persona entera: la supresión la deja irreconocible y no hay vuelta
    // atrás, que es justamente lo que se está probando.
    await prisma.usuario.deleteMany({ where: { empresaId } });
    const tema = await prisma.tema.upsert({
      where: { empresaId_nombreNormalizado: { empresaId, nombreNormalizado: 'excel avanzado' } },
      update: { creadoPorId: null },
      create: { empresaId, nombre: 'Excel avanzado', nombreNormalizado: 'excel avanzado' },
    });
    temaId = tema.id;
    estudianteId = await crearEstudiante(EMAIL_ESTUDIANTE);
    await prisma.tema.update({ where: { id: temaId }, data: { creadoPorId: estudianteId } });
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

  it('entrega todo lo que guarda de la persona que lo pide', async () => {
    const datos = await exportar(await tokenDe(app, EMAIL_ESTUDIANTE));

    expect(datos.servicio).toBe('identity-service');
    expect(datos.contenido.cuenta).toMatchObject([
      { email: EMAIL_ESTUDIANTE, nombre: 'Camila', cargo: 'Operadora' },
    ]);
    expect(datos.contenido.roles).toEqual(['ESTUDIANTE']);
    expect(datos.contenido.perfilCorporativo).toMatchObject([
      { interesesGenerales: 'Quiero aprender Excel' },
    ]);
    expect(datos.contenido.loQueEnsenoYQuieroAprender).toEqual([
      {
        tema: 'Excel avanzado',
        tipo: 'APRENDER',
        dimensiones: ['CONTENIDO', 'HABILIDAD'],
        nivel: 'BASICO',
      },
    ]);
    expect(datos.contenido.avisosDePrivacidadAceptados).toMatchObject([
      { versionAviso: '2026-01' },
    ]);
    expect(datos.contenido.temasQueAgregueAlCatalogo).toEqual(['Excel avanzado']);
  });

  it('no incluye la contraseña, ni siquiera su hash', async () => {
    const datos = await exportar(await tokenDe(app, EMAIL_ESTUDIANTE));

    expect(JSON.stringify(datos)).not.toContain('passwordHash');
    expect(JSON.stringify(datos)).not.toContain('$argon');
  });

  it('cada quien exporta lo suyo: el usuario sale del token, no de la petición', async () => {
    await crearEstudiante(EMAIL_OTRO);

    const datos = await exportar(await tokenDe(app, EMAIL_OTRO));

    const cuenta = datos.contenido.cuenta as { email: string }[];
    expect(cuenta).toHaveLength(1);
    expect(cuenta[0]!.email).toBe(EMAIL_OTRO);
  });

  it('deja la cuenta sin nombre, sin correo y sin contraseña, pero con su id', async () => {
    const { body } = await suprimir(await tokenDe(app, EMAIL_ESTUDIANTE)).expect(200);

    expect((body as SupresionDeServicio).borrado).toMatchObject({
      declaracionesDePerfil: 1,
      perfilCorporativo: 1,
      avisosAceptados: 1,
      sesionesYTokens: 1,
      cuenta: 1,
    });

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: estudianteId } });
    expect(usuario).toMatchObject({
      email: null,
      passwordHash: null,
      nombre: null,
      apellido: null,
      cargo: null,
      areaId: null,
      estado: 'ANONIMIZADO',
    });
    expect(usuario.anonimizadoAt).toBeInstanceOf(Date);
    // El id y la empresa quedan: de ellos cuelgan cosas que son de otros.
    expect(usuario.empresaId).toBe(empresaId);
  });

  it('borra el perfil, las declaraciones, los avisos y los tokens', async () => {
    await suprimir(await tokenDe(app, EMAIL_ESTUDIANTE)).expect(200);

    expect(await prisma.perfilCorporativo.count({ where: { usuarioId: estudianteId } })).toBe(0);
    expect(await prisma.perfilInteres.count({ where: { usuarioId: estudianteId } })).toBe(0);
    expect(await prisma.aceptacionAviso.count({ where: { usuarioId: estudianteId } })).toBe(0);
    expect(await prisma.tokenAcceso.count({ where: { usuarioId: estudianteId } })).toBe(0);
  });

  it('el tema que agregó al catálogo queda, pero sin decir que fue ella', async () => {
    await suprimir(await tokenDe(app, EMAIL_ESTUDIANTE)).expect(200);

    const tema = await prisma.tema.findUniqueOrThrow({ where: { id: temaId } });
    expect(tema.nombre).toBe('Excel avanzado');
    expect(tema.creadoPorId).toBeNull();
  });

  it('después de suprimir, el token deja de servir', async () => {
    const token = await tokenDe(app, EMAIL_ESTUDIANTE);
    await suprimir(token).expect(200);

    // El guard resuelve el estado contra esta base en cada petición, y ANONIMIZADO no es activo.
    await request(app.getHttpServer())
      .get(RUTA)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('una cuenta del equipo ENACTIVA no se suprime desde aquí', async () => {
    const { body } = await suprimir(await tokenDe(app, EMAIL_ADMIN)).expect(403);

    expect((body as { message: string }).message).toMatch(/Admin Principal/);
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: EMAIL_ADMIN } });
    expect(admin.estado).toBe('ACTIVO');
  });

  it('queda en la auditoría qué pasó, sin guardar el nombre ni el correo', async () => {
    await exportar(await tokenDe(app, EMAIL_ESTUDIANTE));
    await suprimir(await tokenDe(app, EMAIL_ESTUDIANTE)).expect(200);

    const registros = await prisma.registroAuditoria.findMany({
      where: { entidadId: estudianteId },
      orderBy: { id: 'asc' },
    });

    expect(registros.map((registro) => registro.accion)).toEqual(['EXPORTAR', 'ANONIMIZAR']);
    // Los nombres de los campos, no su contenido: así la auditoría sobrevive sin datos personales.
    expect(registros[1]!.camposModificados).toContain('email');
    expect(serializar(registros)).not.toContain(EMAIL_ESTUDIANTE);
    expect(serializar(registros)).not.toContain('Camila');
  });

  it('sin token no se exporta ni se suprime', async () => {
    await request(app.getHttpServer()).get(RUTA).expect(401);
    await request(app.getHttpServer()).delete(RUTA).expect(401);
  });
});
