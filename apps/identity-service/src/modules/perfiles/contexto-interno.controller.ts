import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  MAXIMO_TEMAS_INTERNOS,
  PREFIJO_INTERNO,
  type ContextoAfinidad,
  type DeclaracionInterna,
  type PersonaInterna,
} from '@enactiva/shared';
import { SoloSesion } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Tantas personas como talleres puede traer un mazo, más quien lo mira. */
const MAXIMO_PERSONAS = 100;

/**
 * Lo que matching-service necesita de identity para armar el mazo del swipe (ADR-0007).
 *
 * Va con el token de quien pide, así que el acotado por empresa decide qué existe: una persona
 * o un tema de otra organización simplemente no vuelve en la respuesta, sin que matching tenga
 * que saber nada de empresas.
 *
 * Devuelve nombre, cargo y área porque **eso es lo que muestra la tarjeta**. Nada más: el email
 * y el resto del perfil no salen de este servicio (minimización, Ley 21.719).
 */
@Controller(`${PREFIJO_INTERNO}/perfiles`)
export class ContextoInternoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('contexto')
  @SoloSesion()
  async contexto(
    @Query('personas') personas?: string,
    @Query('temas') temas?: string,
  ): Promise<ContextoAfinidad> {
    const idsPersonas = this.aLista(personas, MAXIMO_PERSONAS, 'personas');
    const idsTemas = this.aLista(temas, MAXIMO_TEMAS_INTERNOS, 'temas');

    if (idsPersonas.length === 0) {
      return { personas: [], declaraciones: [], temas: [] };
    }

    const [encontradas, declaraciones, catalogo] = await Promise.all([
      this.prisma.acotado.usuario.findMany({
        where: { id: { in: idsPersonas } },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          cargo: true,
          areaId: true,
          area: { select: { nombre: true } },
        },
      }),
      this.prisma.acotado.perfilInteres.findMany({
        where: {
          usuarioId: { in: idsPersonas },
          ...(idsTemas.length ? { temaId: { in: idsTemas } } : {}),
        },
        select: { usuarioId: true, temaId: true, tipo: true, dimensiones: true, nivel: true },
      }),
      idsTemas.length
        ? this.prisma.acotado.tema.findMany({
            where: { id: { in: idsTemas } },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([]),
    ]);

    const personasInternas: PersonaInterna[] = encontradas.map((persona) => ({
      id: persona.id,
      nombre: persona.nombre,
      apellido: persona.apellido,
      cargo: persona.cargo,
      areaId: persona.areaId,
      areaNombre: persona.area?.nombre ?? null,
    }));

    return {
      personas: personasInternas,
      declaraciones: declaraciones as DeclaracionInterna[],
      temas: catalogo,
    };
  }

  private aLista(valor: string | undefined, maximo: number, que: string): string[] {
    const lista = (valor ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (lista.length > maximo) {
      throw new BadRequestException(`Demasiados ${que} en una sola consulta`);
    }
    return lista;
  }
}
