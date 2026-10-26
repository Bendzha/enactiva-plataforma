import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MatchPuntuado,
  MetricasDeMatches,
  PuntuarMatchInput,
  RespuestaPuntuacionMatch,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { ClientesInternos } from '../../clientes.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** Lo que una fila de puntuación trae de la base. */
interface PuntuacionEnBase {
  autorId: string;
  papel: 'ESTUDIANTE' | 'CAPACITADOR';
  seReunieron: boolean;
  aLaHoraAcordada: boolean;
  comoLoEsperaban: boolean;
  repetirian: boolean;
  createdAt: Date;
}

/**
 * Puntuación del match (SPEC §3.5, ADR-0009).
 *
 * Las cuatro preguntas son las que mandó la clienta por WhatsApp el 2026-09-29. Miden si el
 * **emparejamiento** funcionó, no si el taller estuvo bueno: las estrellas son otra cosa y viven
 * en learning. Un match puede fallar —nunca se reunieron— con un taller impecable, y al revés.
 *
 * Las contestan **ambas partes**, después de la primera reunión (Q15). Si solo responde una, el
 * match igual queda puntuado con esa respuesta: nadie puede quedar bloqueado esperando a la otra.
 */
@Injectable()
export class PuntuacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly clientes: ClientesInternos,
  ) {}

  /**
   * Puntúa el match de un taller.
   *
   * Quien responde tiene que ser una de las dos partes, y el taller tiene que haber terminado:
   * antes de la primera reunión no hay nada que contestar.
   */
  async puntuar(
    tallerId: string,
    entrada: PuntuarMatchInput,
    sesion: SesionActual,
  ): Promise<MatchPuntuado> {
    const empresaId = this.empresaDe(sesion);

    const match = await this.mio(tallerId, sesion);
    if (!match) {
      throw new NotFoundException('No hay un match tuyo para ese taller');
    }
    const papel = this.papelDe(match, sesion.usuarioId)!;

    const taller = await this.tallerTerminado(tallerId);

    const yaRespondio = await this.prisma.puntuacionMatch.findUnique({
      where: { matchId_autorId: { matchId: match.id, autorId: sesion.usuarioId } },
      select: { id: true },
    });
    if (yaRespondio) {
      throw new ConflictException('Ya puntuaste este match');
    }

    await this.prisma.puntuacionMatch.create({
      data: { empresaId, matchId: match.id, autorId: sesion.usuarioId, papel, ...entrada },
    });

    await this.auditoria.registrar({
      accion: 'CREAR',
      entidad: 'PuntuacionMatch',
      entidadId: match.id,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: ['seReunieron', 'aLaHoraAcordada', 'comoLoEsperaban', 'repetirian'],
      ip: sesion.ip,
    });

    return this.armar(match, taller.nombre);
  }

  /** Lo que se sabe de un match: sus dos respuestas, o la única que haya llegado. */
  async delTaller(tallerId: string, sesion: SesionActual): Promise<MatchPuntuado | null> {
    this.empresaDe(sesion);

    const match = await this.mio(tallerId, sesion);
    return match ? this.armar(match, '') : null;
  }

  /**
   * Lo que RRHH ve en su panel: de los matches que alguien contestó, cuántos funcionaron.
   *
   * Es un agregado y nunca dice quién respondió qué: la clienta pidió entender si los matches
   * funcionan, no auditar a cada persona.
   */
  async metricas(sesion: SesionActual): Promise<MetricasDeMatches> {
    this.empresaDe(sesion);

    const respuestas = await this.prisma.acotado.puntuacionMatch.findMany({
      select: {
        matchId: true,
        seReunieron: true,
        aLaHoraAcordada: true,
        comoLoEsperaban: true,
        repetirian: true,
      },
    });

    return {
      matchesConRespuesta: new Set(respuestas.map((fila) => fila.matchId)).size,
      seReunieron: respuestas.filter((fila) => fila.seReunieron).length,
      aLaHoraAcordada: respuestas.filter((fila) => fila.aLaHoraAcordada).length,
      comoLoEsperaban: respuestas.filter((fila) => fila.comoLoEsperaban).length,
      repetirian: respuestas.filter((fila) => fila.repetirian).length,
    };
  }

  /**
   * Los talleres de esta persona que ya terminaron y ella todavía no puntuó.
   *
   * Es lo que la pantalla necesita para no preguntarle dos veces por lo mismo ni pedirle que
   * puntúe algo que aún no ocurre.
   */
  async pendientesDe(sesion: SesionActual): Promise<string[]> {
    this.empresaDe(sesion);

    const mios = await this.prisma.acotado.match.findMany({
      where: {
        decision: 'INTERESADO',
        OR: [{ estudianteId: sesion.usuarioId }, { capacitadorId: sesion.usuarioId }],
      },
      select: { id: true, tallerId: true, puntuaciones: { select: { autorId: true } } },
    });

    return mios
      .filter((match) => !match.puntuaciones.some((fila) => fila.autorId === sesion.usuarioId))
      .map((match) => match.tallerId);
  }

  /**
   * El match de este taller **en el que yo participo**, o null.
   *
   * La condición de ser parte va en la consulta y no en una comprobación posterior: así quien no
   * participa recibe un 404 y no un 403. La diferencia importa, porque un 403 le diría que
   * existe un match ajeno sobre ese taller, y lo que cada quien decide en Descubrir es suyo.
   */
  private mio(tallerId: string, sesion: SesionActual) {
    return this.prisma.acotado.match.findFirst({
      where: {
        tallerId,
        decision: 'INTERESADO',
        OR: [{ estudianteId: sesion.usuarioId }, { capacitadorId: sesion.usuarioId }],
      },
      select: { id: true, estudianteId: true, capacitadorId: true, tallerId: true },
    });
  }

  /** El taller lo sabe learning, no este servicio: aquí solo se guarda la decisión (ADR-0007). */
  private async tallerTerminado(tallerId: string): Promise<{ nombre: string }> {
    const taller = await this.clientes.tallerPorId(tallerId);
    if (!taller) {
      throw new NotFoundException('Ese taller no existe en tu empresa');
    }
    if (new Date(taller.finAt).getTime() > Date.now()) {
      throw new BadRequestException('Este taller todavía no termina');
    }
    return taller;
  }

  private async armar(
    match: { id: string; estudianteId: string; capacitadorId: string; tallerId: string },
    tallerNombre: string,
  ): Promise<MatchPuntuado> {
    const respuestas = await this.prisma.puntuacionMatch.findMany({
      where: { matchId: match.id },
      select: {
        autorId: true,
        papel: true,
        seReunieron: true,
        aLaHoraAcordada: true,
        comoLoEsperaban: true,
        repetirian: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      tallerId: match.tallerId,
      tallerNombre,
      estudianteId: match.estudianteId,
      capacitadorId: match.capacitadorId,
      respuestas: respuestas.map(aRespuesta),
    };
  }

  private papelDe(
    match: { estudianteId: string; capacitadorId: string },
    usuarioId: string,
  ): 'ESTUDIANTE' | 'CAPACITADOR' | null {
    if (match.estudianteId === usuarioId) return 'ESTUDIANTE';
    if (match.capacitadorId === usuarioId) return 'CAPACITADOR';
    return null;
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}

function aRespuesta(fila: PuntuacionEnBase): RespuestaPuntuacionMatch {
  return {
    autorId: fila.autorId,
    papel: fila.papel,
    seReunieron: fila.seReunieron,
    aLaHoraAcordada: fila.aLaHoraAcordada,
    comoLoEsperaban: fila.comoLoEsperaban,
    repetirian: fila.repetirian,
    createdAt: fila.createdAt.toISOString(),
  };
}
