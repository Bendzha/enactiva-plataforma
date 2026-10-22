/**
 * Datos de demo en learning_db: talleres convocados, inscripciones y disponibilidad.
 *
 * No consulta identity_db: los ids de las personas y de los temas son constantes compartidas
 * (`datos.ts`), igual que en producción learning guarda `temaId` sin clave foránea porque el
 * catálogo vive en otra base (ADR-0007).
 */
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'learning-service/src/generated/prisma/client.js';
import { DISPONIBILIDAD, fechaRelativa, TALLERES } from './datos.js';

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

export async function sembrarLearning(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_LEARNING }),
  });

  try {
    let inscripciones = 0;

    for (const taller of TALLERES) {
      const inicioAt = fechaRelativa(taller.enDias, taller.horaInicio);
      const finAt = fechaRelativa(taller.enDias, taller.horaFin);
      const ficha = {
        nombre: taller.nombre,
        objetivo: taller.objetivo,
        resultadosEsperados: taller.resultadosEsperados,
        ubicacion: taller.ubicacion,
        inicioAt,
        finAt,
        cupo: taller.cupo,
      };

      // Las fechas se recalculan en cada seed: un taller "en 3 días" tiene que seguir estando
      // en 3 días la semana que viene, o la demo se llena de talleres vencidos.
      await prisma.taller.upsert({
        where: { id: taller.id },
        update: ficha,
        create: {
          id: taller.id,
          empresaId: taller.empresaId,
          capacitadorId: taller.capacitadorId,
          temaId: taller.temaId,
          ...ficha,
        },
      });

      for (const usuarioId of taller.inscritos) {
        await prisma.inscripcion.upsert({
          where: { tallerId_usuarioId: { tallerId: taller.id, usuarioId } },
          update: {},
          create: { empresaId: taller.empresaId, tallerId: taller.id, usuarioId },
        });
        inscripciones += 1;
      }
    }

    for (const franja of DISPONIBILIDAD) {
      await prisma.disponibilidad.upsert({
        where: {
          usuarioId_dia_horaInicio_horaFin: {
            usuarioId: franja.usuarioId,
            dia: franja.dia,
            horaInicio: franja.horaInicio,
            horaFin: franja.horaFin,
          },
        },
        update: {},
        create: {
          empresaId: franja.empresaId,
          usuarioId: franja.usuarioId,
          dia: franja.dia,
          horaInicio: franja.horaInicio,
          horaFin: franja.horaFin,
        },
      });
    }

    console.log(
      `learning_db: ${TALLERES.length} talleres, ${inscripciones} inscripciones y ` +
        `${DISPONIBILIDAD.length} franjas de disponibilidad.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
