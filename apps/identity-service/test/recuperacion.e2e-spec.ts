import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import { CABECERA_INTERNO, HORAS_PARA_RESTABLECER } from '@enactiva/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { hashPassword, verificarPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { tokenDesdeElCorreo, vaciarBandeja } from './mailpit.js';
import { ALMACEN_SIN_LIMITE } from './utilidades.js';

const EMAIL_ADMIN = process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase();
const PASSWORD_VIEJA = 'clave-vieja-de-prueba';
const PASSWORD_NUEVA = 'clave-nueva-de-prueba';
const EMAIL = 'recupera@plataforma.local';
const EMAIL_INVITADA = 'invitada.recupera@plataforma.local';
const SECRETO = process.env.INTERNO_SECRETO!;

describe('Recuperar la contraseña (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let usuarioId: string;
  let empresaId: string;

  const limpiar = async () => {
    await prisma.usuario.deleteMany({ where: { email: { in: [EMAIL, EMAIL_INVITADA] } } });
    const empresas = await prisma.empresa.findMany({
      where: { nombre: { contains: '(recuperacion e2e)' } },
      select: { id: true },
    });
    await prisma.empresa.deleteMany({ where: { id: { in: empresas.map((e) => e.id) } } });
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
      data: { nombre: 'Planta Oeste (recuperacion e2e)', rubro: 'Minería', creadaPorId: admin.id },
    });
    empresaId = empresa.id;
  });

  beforeEach(async () => {
    await prisma.usuario.deleteMany({ where: { email: { in: [EMAIL, EMAIL_INVITADA] } } });
    const usuario = await prisma.usuario.create({
      data: {
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD_VIEJA),
        nombre: 'Rosa',
        estado: 'ACTIVO',
        empresaId,
        roles: { create: { rol: 'ESTUDIANTE' } },
      },
    });
    usuarioId = usuario.id;
    // La bandeja es compartida: sin vaciarla, el enlace del test anterior se cuela en este.
    await vaciarBandeja();
  });

  afterAll(async () => {
    await limpiar();
    await app.close();
  });

  const solicitar = (email: string) =>
    request(app.getHttpServer())
      .post('/interno/recuperacion/solicitar')
      .set(CABECERA_INTERNO, SECRETO)
      .send({ email });

  const restablecer = (token: string, password: string) =>
    request(app.getHttpServer())
      .post('/interno/recuperacion/restablecer')
      .set(CABECERA_INTERNO, SECRETO)
      .send({ token, password });

  /** El token en claro solo viaja en el correo: acá se saca del enlace, como haría la persona. */
  const tokenDelCorreo = (email: string) => tokenDesdeElCorreo(email, 'restablecer');

  it('manda un enlace que vence en dos horas y sirve una sola vez', async () => {
    await solicitar(EMAIL).expect(204);

    const guardado = await prisma.tokenAcceso.findFirstOrThrow({
      where: { usuarioId, tipo: 'RESET_PASSWORD' },
    });
    const horas = (guardado.expiraAt.getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(HORAS_PARA_RESTABLECER - 0.1);
    expect(horas).toBeLessThanOrEqual(HORAS_PARA_RESTABLECER);
    expect(guardado.usadoAt).toBeNull();
  });

  it('en la base queda el hash, nunca el token en claro', async () => {
    await solicitar(EMAIL).expect(204);
    const token = await tokenDelCorreo(EMAIL);

    const guardado = await prisma.tokenAcceso.findFirstOrThrow({
      where: { usuarioId, tipo: 'RESET_PASSWORD' },
    });
    expect(token.length).toBeGreaterThan(20);
    expect(guardado.tokenHash).not.toBe(token);
  });

  it('cambia la contraseña y deja entrar con la nueva', async () => {
    await solicitar(EMAIL).expect(204);
    const token = await tokenDelCorreo(EMAIL);

    await restablecer(token, PASSWORD_NUEVA).expect(204);

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    expect(await verificarPassword(PASSWORD_NUEVA, usuario.passwordHash!)).toBe(true);
    expect(await verificarPassword(PASSWORD_VIEJA, usuario.passwordHash!)).toBe(false);
  });

  it('cambiar la contraseña cierra todas las sesiones abiertas', async () => {
    // Dos sesiones vivas: es lo que pasa cuando alguien entró desde el teléfono y el computador.
    await prisma.tokenAcceso.createMany({
      data: [
        {
          usuarioId,
          tipo: 'REFRESH',
          tokenHash: `sesion-uno-${usuarioId}`,
          expiraAt: new Date(Date.now() + 86_400_000),
        },
        {
          usuarioId,
          tipo: 'REFRESH',
          tokenHash: `sesion-dos-${usuarioId}`,
          expiraAt: new Date(Date.now() + 86_400_000),
        },
      ],
    });

    await solicitar(EMAIL).expect(204);
    await restablecer(await tokenDelCorreo(EMAIL), PASSWORD_NUEVA).expect(204);

    const vivas = await prisma.tokenAcceso.count({
      where: { usuarioId, tipo: 'REFRESH', revocadoAt: null },
    });
    expect(vivas).toBe(0);
  });

  it('el enlace no se puede usar dos veces', async () => {
    await solicitar(EMAIL).expect(204);
    const token = await tokenDelCorreo(EMAIL);

    await restablecer(token, PASSWORD_NUEVA).expect(204);
    const { body } = await restablecer(token, 'otra-clave-distinta').expect(410);

    expect((body as { message: string }).message).toMatch(/ya no sirve/i);
  });

  it('pedir uno nuevo invalida el anterior', async () => {
    await solicitar(EMAIL).expect(204);
    const primero = await tokenDelCorreo(EMAIL);
    await solicitar(EMAIL).expect(204);

    await restablecer(primero, PASSWORD_NUEVA).expect(410);
  });

  it('un enlace vencido no sirve', async () => {
    await solicitar(EMAIL).expect(204);
    const token = await tokenDelCorreo(EMAIL);
    await prisma.tokenAcceso.updateMany({
      where: { usuarioId, tipo: 'RESET_PASSWORD' },
      data: { expiraAt: new Date(Date.now() - 1000) },
    });

    await restablecer(token, PASSWORD_NUEVA).expect(410);
  });

  it('un token inventado da el mismo error que uno vencido', async () => {
    const { body } = await restablecer('x'.repeat(43), PASSWORD_NUEVA).expect(410);

    // Mismo mensaje para inexistente, usado, revocado o vencido: no se confirma cuál era.
    expect((body as { message: string }).message).toMatch(/ya no sirve/i);
  });

  it('la contraseña nueva tiene que cumplir la política', async () => {
    await solicitar(EMAIL).expect(204);
    const token = await tokenDelCorreo(EMAIL);

    await restablecer(token, 'corta').expect(400);
  });

  it('un correo que no existe responde igual y no manda nada', async () => {
    // Se compara contra el antes y no contra cero: la base la comparten los demás tests y los
    // datos de demo, así que un cero absoluto fallaría por motivos ajenos a esto.
    const antes = await prisma.tokenAcceso.count({ where: { tipo: 'RESET_PASSWORD' } });

    await solicitar('nadie.aqui@plataforma.local').expect(204);

    expect(await prisma.tokenAcceso.count({ where: { tipo: 'RESET_PASSWORD' } })).toBe(antes);
  });

  it('una cuenta invitada y sin activar no se recupera: su invitación sigue viva', async () => {
    const invitada = await prisma.usuario.create({
      data: { email: EMAIL_INVITADA, estado: 'INVITADO', empresaId },
    });

    await solicitar(EMAIL_INVITADA).expect(204);

    expect(
      await prisma.tokenAcceso.count({ where: { usuarioId: invitada.id, tipo: 'RESET_PASSWORD' } }),
    ).toBe(0);
  });

  it('queda en la auditoría, sin el token ni la contraseña', async () => {
    await solicitar(EMAIL).expect(204);
    await restablecer(await tokenDelCorreo(EMAIL), PASSWORD_NUEVA).expect(204);

    const registros = await prisma.registroAuditoria.findMany({
      where: { entidadId: usuarioId },
      orderBy: { id: 'asc' },
    });

    expect(registros.map((registro) => registro.entidad)).toEqual(['TokenAcceso', 'Usuario']);
    expect(registros[1]!.camposModificados).toEqual(['passwordHash', 'sesiones']);
    expect(registros.flatMap((r) => r.camposModificados).join(' ')).not.toContain(PASSWORD_NUEVA);
  });

  it('sin el secreto compartido no se alcanza desde afuera', async () => {
    await request(app.getHttpServer())
      .post('/interno/recuperacion/solicitar')
      .send({ email: EMAIL })
      .expect(401);
  });
});
