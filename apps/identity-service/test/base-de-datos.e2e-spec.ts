import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { verificarPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Requiere Postgres levantado (docker compose), migraciones aplicadas y seed ejecutado.
describe('Base de datos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('el seed crea al Admin Principal activo, sin empresa y con rol ADMIN_ENACTIVA', async () => {
    const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    expect(email).toBeTruthy();
    expect(password).toBeTruthy();

    const admin = await prisma.usuario.findUnique({
      where: { email: email! },
      include: { roles: true },
    });

    expect(admin).toMatchObject({ estado: 'ACTIVO', nivelAdmin: 'PRINCIPAL', empresaId: null });
    expect(admin!.roles.map((r) => r.rol)).toEqual(['ADMIN_ENACTIVA']);
    await expect(verificarPassword(password!, admin!.passwordHash!)).resolves.toBe(true);
  });

  it('el seed deja constancia en el registro de auditoría sin valores personales', async () => {
    const admin = await prisma.usuario.findUniqueOrThrow({
      where: { email: process.env.SEED_ADMIN_EMAIL!.trim().toLowerCase() },
    });
    const registro = await prisma.registroAuditoria.findFirst({
      where: { accion: 'CREAR', entidad: 'Usuario', entidadId: admin.id },
    });

    expect(registro).not.toBeNull();
    expect(registro!.camposModificados).toContain('passwordHash');
    const serializado = JSON.stringify(registro, (_clave, valor: unknown) =>
      typeof valor === 'bigint' ? valor.toString() : valor,
    );
    expect(serializado).not.toContain(admin.email!);
  });

  // Cada intento corre en una transacción que se revierte: no deja filas de prueba en la auditoría.
  it('el registro de auditoría rechaza UPDATE', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const fila = await tx.registroAuditoria.create({
          data: { accion: 'CREAR', entidad: 'PruebaE2E' },
        });
        await tx.registroAuditoria.update({ where: { id: fila.id }, data: { entidad: 'Otra' } });
      }),
    ).rejects.toThrow(/append-only/);
  });

  it('el registro de auditoría rechaza DELETE', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const fila = await tx.registroAuditoria.create({
          data: { accion: 'CREAR', entidad: 'PruebaE2E' },
        });
        await tx.registroAuditoria.delete({ where: { id: fila.id } });
      }),
    ).rejects.toThrow(/append-only/);
  });
});
