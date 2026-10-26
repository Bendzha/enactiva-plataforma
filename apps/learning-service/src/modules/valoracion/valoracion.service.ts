import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DIMENSIONES_VALORACION,
  VALORACIONES_PARA_CONTAR_EN_EL_SCORE,
  type DimensionValoracion,
  type EstrellasDelTaller,
  type EstrellasPorDimension,
  type MiValoracion,
  type ReconocimientoPersona,
  type ValorarTallerInput,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/**
 * Valoración del encuentro y tokens de reconocimiento (SPEC §3.5, ADR-0009).
 *
 * Mide **si el encuentro sirvió**, no cuánto aprendió alguien: eso salió del alcance el
 * 2026-10-13 (ADR-0010). Las estrellas alimentan el promedio del facilitador, que ordena el mazo
 * de Descubrir, y la primera valoración de cada taller le da su token.
 */
@Injectable()
export class ValoracionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Valora un taller.
   *
   * Tres condiciones, y las tres por la misma razón —que el promedio signifique algo—: el taller
   * tiene que haber terminado, la persona tiene que haber estado inscrita, y no puede valorar
   * dos veces.
   */
  async valorar(
    tallerId: string,
    entrada: ValorarTallerInput,
    sesion: SesionActual,
  ): Promise<MiValoracion> {
    const empresaId = this.empresaDe(sesion);

    const taller = await this.prisma.acotado.taller.findUnique({
      where: { id: tallerId },
      select: { id: true, finAt: true, capacitadorId: true },
    });
    if (!taller) {
      throw new NotFoundException('Ese taller no existe en tu empresa');
    }
    if (taller.finAt.getTime() > Date.now()) {
      throw new BadRequestException('Este taller todavía no termina');
    }
    if (taller.capacitadorId === sesion.usuarioId) {
      // Valorarse a uno mismo subiría su propio promedio y se daría un token.
      throw new ForbiddenException('No puedes valorar un taller que dictaste tú');
    }

    const inscrito = await this.prisma.acotado.inscripcion.findFirst({
      where: { tallerId, usuarioId: sesion.usuarioId },
      select: { id: true },
    });
    if (!inscrito) {
      throw new ForbiddenException('Solo valora el taller quien se inscribió en él');
    }

    const referencia = entrada.referencia.trim();

    const valoracion = await this.prisma.$transaction(async (tx) => {
      const existe = await tx.valoracionTaller.findUnique({
        where: { tallerId_usuarioId: { tallerId, usuarioId: sesion.usuarioId } },
        select: { id: true },
      });
      if (existe) {
        throw new ConflictException('Ya valoraste este taller');
      }

      const creada = await tx.valoracionTaller.create({
        data: {
          empresaId,
          tallerId,
          usuarioId: sesion.usuarioId,
          asistio: entrada.asistio,
          estrellas: {
            create: DIMENSIONES_VALORACION.map((dimension) => ({
              dimension,
              estrellas: entrada.estrellas[dimension]!,
            })),
          },
          ...(referencia
            ? {
                referencia: {
                  create: {
                    empresaId,
                    tallerId,
                    autorId: sesion.usuarioId,
                    capacitadorId: taller.capacitadorId,
                    texto: referencia,
                  },
                },
              }
            : {}),
        },
        select: this.seleccionDeValoracion(),
      });

      // El token del facilitador: uno por taller, con la primera valoración que recibe. La
      // clave única sobre tallerId es la que impide duplicarlo si tres personas valoran a la
      // vez; `skipDuplicates` deja que la segunda y la tercera pasen sin hacer nada.
      await tx.token.createMany({
        data: [{ empresaId, capacitadorId: taller.capacitadorId, tallerId }],
        skipDuplicates: true,
      });

      return creada;
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'ValoracionTaller',
      entidadId: valoracion.id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: referencia
        ? ['estrellas', 'asistio', 'referencia']
        : ['estrellas', 'asistio'],
      ip: sesion.ip,
    });

    return this.aMiValoracion(valoracion);
  }

  /** Lo que yo respondí sobre un taller, o null si todavía no lo valoré. */
  async mia(tallerId: string, sesion: SesionActual): Promise<MiValoracion | null> {
    this.empresaDe(sesion);
    const valoracion = await this.prisma.acotado.valoracionTaller.findFirst({
      where: { tallerId, usuarioId: sesion.usuarioId },
      select: this.seleccionDeValoracion(),
    });
    return valoracion ? this.aMiValoracion(valoracion) : null;
  }

  /**
   * Las estrellas de un taller, promediadas.
   *
   * Nunca el detalle por persona: no aporta y expone a quien valoró (SPEC §3.5). Lo ve
   * cualquiera de la empresa, incluido quien lo dictó.
   */
  async delTaller(tallerId: string, sesion: SesionActual): Promise<EstrellasDelTaller> {
    this.empresaDe(sesion);

    const valoraciones = await this.prisma.acotado.valoracionTaller.findMany({
      where: { tallerId },
      select: { asistio: true, estrellas: { select: { dimension: true, estrellas: true } } },
    });

    return {
      tallerId,
      cuantasValoraciones: valoraciones.length,
      asistieron: valoraciones.filter((valoracion) => valoracion.asistio).length,
      promedioGeneral: promedio(valoraciones.flatMap((v) => v.estrellas.map((e) => e.estrellas))),
      promedioPorDimension: this.promediarPorDimension(valoraciones.flatMap((v) => v.estrellas)),
    };
  }

  /**
   * El reconocimiento de una persona: tokens, talleres dictados y su promedio de estrellas.
   *
   * El recuento lo ve cualquiera de la empresa **[E]**: la clienta dijo "visibles pero privados"
   * y el equipo lo interpretó como visible dentro de la organización. Está preguntado.
   */
  async reconocimientoDe(usuarioId: string, sesion: SesionActual): Promise<ReconocimientoPersona> {
    this.empresaDe(sesion);

    const [tokens, talleresDictados, estrellas] = await Promise.all([
      this.prisma.acotado.token.aggregate({
        where: { capacitadorId: usuarioId },
        _sum: { cantidad: true },
      }),
      this.prisma.acotado.taller.count({ where: { capacitadorId: usuarioId } }),
      this.estrellasRecibidasPor([usuarioId]),
    ]);

    const recibidas = estrellas.get(usuarioId) ?? { cuantas: 0, valores: [] };
    const cuentaEnElScore = recibidas.cuantas >= VALORACIONES_PARA_CONTAR_EN_EL_SCORE;

    return {
      usuarioId,
      tokens: tokens._sum.cantidad ?? 0,
      talleresDictados,
      cuantasValoraciones: recibidas.cuantas,
      promedioEstrellas: promedio(recibidas.valores),
      cuentaEnElScore,
    };
  }

  /**
   * El promedio de estrellas de varios facilitadores, para el cuarto criterio del score.
   *
   * Devuelve `null` mientras alguien no llegue a `VALORACIONES_PARA_CONTAR_EN_EL_SCORE`, y el
   * score reparte ese peso entre los demás criterios. Sin ese piso, una sola opinión mala
   * hundiría a alguien en el mazo para siempre (ADR-0009).
   */
  async promediosDe(capacitadorIds: readonly string[]): Promise<Map<string, number | null>> {
    const recibidas = await this.estrellasRecibidasPor(capacitadorIds);

    return new Map(
      capacitadorIds.map((id) => {
        const suyas = recibidas.get(id);
        if (!suyas || suyas.cuantas < VALORACIONES_PARA_CONTAR_EN_EL_SCORE) return [id, null];
        return [id, promedio(suyas.valores)];
      }),
    );
  }

  /**
   * Las estrellas que recibió cada facilitador, por los talleres que dictó.
   *
   * Es un join a mano entre taller y valoración porque la valoración cuelga del taller y no de
   * la persona: quien recibe las estrellas es quien lo dictó, no quien las escribió.
   */
  private async estrellasRecibidasPor(
    capacitadorIds: readonly string[],
  ): Promise<Map<string, { cuantas: number; valores: number[] }>> {
    const unicos = [...new Set(capacitadorIds)];
    if (unicos.length === 0) return new Map();

    const talleres = await this.prisma.taller.findMany({
      where: { capacitadorId: { in: unicos } },
      select: {
        capacitadorId: true,
        valoraciones: { select: { estrellas: { select: { estrellas: true } } } },
      },
    });

    const porPersona = new Map<string, { cuantas: number; valores: number[] }>();
    for (const taller of talleres) {
      const acumulado = porPersona.get(taller.capacitadorId) ?? { cuantas: 0, valores: [] };
      for (const valoracion of taller.valoraciones) {
        acumulado.cuantas += 1;
        acumulado.valores.push(...valoracion.estrellas.map((estrella) => estrella.estrellas));
      }
      porPersona.set(taller.capacitadorId, acumulado);
    }
    return porPersona;
  }

  private promediarPorDimension(
    estrellas: { dimension: DimensionValoracion; estrellas: number }[],
  ): EstrellasPorDimension[] {
    return DIMENSIONES_VALORACION.map((dimension) => ({
      dimension,
      estrellas:
        promedio(estrellas.filter((e) => e.dimension === dimension).map((e) => e.estrellas)) ?? 0,
    })).filter((fila) => fila.estrellas > 0);
  }

  private seleccionDeValoracion() {
    return {
      id: true,
      tallerId: true,
      asistio: true,
      createdAt: true,
      estrellas: { select: { dimension: true, estrellas: true } },
      referencia: { select: { texto: true } },
    } as const;
  }

  private aMiValoracion(valoracion: {
    tallerId: string;
    asistio: boolean;
    createdAt: Date;
    estrellas: { dimension: DimensionValoracion; estrellas: number }[];
    referencia: { texto: string } | null;
  }): MiValoracion {
    return {
      tallerId: valoracion.tallerId,
      asistio: valoracion.asistio,
      // En el orden del formulario, no en el que los devolvió la base.
      estrellas: DIMENSIONES_VALORACION.map((dimension) => ({
        dimension,
        estrellas: valoracion.estrellas.find((e) => e.dimension === dimension)?.estrellas ?? 0,
      })),
      referencia: valoracion.referencia?.texto ?? '',
      createdAt: valoracion.createdAt.toISOString(),
    };
  }

  /** El equipo de ENACTIVA no pertenece a ninguna empresa, así que no valora ni recibe nada. */
  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Esta acción es de los colaboradores de una empresa');
    }
    return sesion.empresaId;
  }
}

/** Promedio con un decimal, o null si no hay nada que promediar. */
function promedio(valores: readonly number[]): number | null {
  if (valores.length === 0) return null;
  const suma = valores.reduce((total, valor) => total + valor, 0);
  return Math.round((suma / valores.length) * 10) / 10;
}
