/**
 * Datos de demo en identity_db: empresas, áreas, personas, temas y perfiles.
 *
 * Es idempotente: todo entra por `upsert` contra un id fijo, así que correrlo de nuevo deja
 * exactamente el mismo estado. No escribe en la auditoría a propósito —esa tabla es append-only
 * y se llena con lo que haga la gente durante la demo, no con datos de relleno.
 */
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'identity-service/src/common/password.js';
import { PrismaClient } from 'identity-service/src/generated/prisma/client.js';
import { AREAS, EMPRESAS, INTERESES, passwordDemo, TEMAS, USUARIOS } from './datos.js';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

/** Igual que la normalización de la aplicación: sin tildes, sin mayúsculas, sin espacios de más. */
function normalizar(valor: string): string {
  return valor.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

export async function sembrarIdentity(): Promise<void> {
  const password = passwordDemo();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_IDENTITY }),
  });

  try {
    const passwordHash = await hashPassword(password);

    // Las empresas necesitan un creador que exista: el Admin Principal de demo va primero y
    // sin empresa, porque el equipo de ENACTIVA no pertenece a ninguna.
    const [principal] = USUARIOS;
    await prisma.usuario.upsert({
      where: { id: principal!.id },
      update: { passwordHash, estado: 'ACTIVO' },
      create: {
        id: principal!.id,
        email: principal!.email,
        passwordHash,
        nombre: principal!.nombre,
        apellido: principal!.apellido,
        cargo: principal!.cargo,
        estado: 'ACTIVO',
        nivelAdmin: principal!.nivelAdmin,
      },
    });

    for (const empresa of Object.values(EMPRESAS)) {
      await prisma.empresa.upsert({
        where: { id: empresa.id },
        update: { nombre: empresa.nombre, rubro: empresa.rubro },
        create: {
          id: empresa.id,
          nombre: empresa.nombre,
          rubro: empresa.rubro,
          estado: 'ACTIVA',
          activadaAt: new Date(),
          activadaPorId: principal!.id,
          creadaPorId: principal!.id,
        },
      });
    }

    for (const area of Object.values(AREAS)) {
      await prisma.area.upsert({
        where: { id: area.id },
        update: { nombre: area.nombre },
        create: {
          id: area.id,
          empresaId: area.empresaId,
          nombre: area.nombre,
          nombreNormalizado: normalizar(area.nombre),
        },
      });
    }

    for (const usuario of USUARIOS) {
      await prisma.usuario.upsert({
        where: { id: usuario.id },
        update: {
          passwordHash,
          estado: 'ACTIVO',
          empresaId: usuario.empresaId,
          areaId: usuario.areaId,
          cargo: usuario.cargo,
        },
        create: {
          id: usuario.id,
          email: usuario.email,
          passwordHash,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          cargo: usuario.cargo,
          estado: 'ACTIVO',
          empresaId: usuario.empresaId,
          areaId: usuario.areaId,
          nivelAdmin: usuario.nivelAdmin,
        },
      });

      // Los roles son una tabla aparte con clave compuesta: se reemplazan enteros para que
      // quitar un rol del archivo de datos también lo quite de la base.
      await prisma.usuarioRol.deleteMany({
        where: { usuarioId: usuario.id, rol: { notIn: [...usuario.roles] } },
      });
      for (const rol of usuario.roles) {
        await prisma.usuarioRol.upsert({
          where: { usuarioId_rol: { usuarioId: usuario.id, rol } },
          update: {},
          create: { usuarioId: usuario.id, rol },
        });
      }
    }

    for (const tema of Object.values(TEMAS)) {
      await prisma.tema.upsert({
        where: { id: tema.id },
        update: { nombre: tema.nombre },
        create: {
          id: tema.id,
          empresaId: tema.empresaId,
          nombre: tema.nombre,
          nombreNormalizado: normalizar(tema.nombre),
        },
      });
    }

    for (const interes of INTERESES) {
      await prisma.perfilInteres.upsert({
        where: { id: interes.id },
        update: { dimensiones: [...interes.dimensiones], nivel: interes.nivel },
        create: {
          id: interes.id,
          empresaId: interes.empresaId,
          usuarioId: interes.usuarioId,
          temaId: interes.temaId,
          tipo: interes.tipo,
          dimensiones: [...interes.dimensiones],
          nivel: interes.nivel,
        },
      });
    }

    console.log(
      `identity_db: ${Object.keys(EMPRESAS).length} empresas, ${USUARIOS.length} personas, ` +
        `${Object.keys(TEMAS).length} temas y ${INTERESES.length} declaraciones de perfil.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
