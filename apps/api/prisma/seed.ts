import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from '../src/common/password.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Crea el Admin Principal inicial a partir de variables de entorno (nunca credenciales en el código).
// Es idempotente: si el email ya existe, no modifica nada.

const LARGO_MINIMO_PASSWORD = 12;

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Faltan SEED_ADMIN_EMAIL o SEED_ADMIN_PASSWORD en apps/api/.env');
  }
  if (password.length < LARGO_MINIMO_PASSWORD) {
    throw new Error(`SEED_ADMIN_PASSWORD debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      console.log('Admin Principal ya existe; no se modifica.');
      return;
    }

    const passwordHash = await hashPassword(password);
    const admin = await prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({
        data: {
          email,
          passwordHash,
          nombre: process.env.SEED_ADMIN_NOMBRE || null,
          apellido: process.env.SEED_ADMIN_APELLIDO || null,
          estado: 'ACTIVO',
          nivelAdmin: 'PRINCIPAL',
          roles: { create: { rol: 'ADMIN_ENACTIVA' } },
        },
      });
      await tx.registroAuditoria.create({
        data: {
          accion: 'CREAR',
          entidad: 'Usuario',
          entidadId: creado.id,
          camposModificados: [
            'email',
            'passwordHash',
            'nombre',
            'apellido',
            'estado',
            'nivelAdmin',
            'roles',
          ],
        },
      });
      return creado;
    });

    console.log(`Admin Principal creado (id ${admin.id}).`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
