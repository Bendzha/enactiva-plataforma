import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  tokensDeQuienEnsena,
  TOKENS_POR_ASISTENCIA_COMPLETA,
  TOKENS_POR_ASISTIR,
  type InscritoEnLista,
  type ListaAsistencia,
  type MarcarAsistenciaInput,
  type ResultadoCierreAsistencia,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { IdentityCliente } from '../../identity.cliente.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';

/** El taller con lo justo para pasar lista. */
interface TallerConInscritos {
  id: string;
  nombre: string;
  capacitadorId: string;
  finAt: Date;
  asistenciaCerradaAt: Date | null;
  inscripciones: { usuarioId: string; asistio: boolean | null }[];
}

/**
 * La lista de asistencia de un taller (reunión 2026-10-29).
 *
 * La clienta lo pidió así: *"el que enseña debe tener el registro de los nombres, nicknames o
 * correos de sus estudiantes para chequear los inscritos v/s los que asistencia"*. Es un
 * checklist y nada más.
 *
 * **Solo la ve quien dicta.** Para el resto, quiénes van a un taller no es información suya, y
 * eso vale también para quienes están en la lista: saber que un colega se inscribió a «Hablar
 * en público» dice algo de él que no le toca a nadie más.
 *
 * Cerrarla es el momento en que se reparten los tokens, y por eso no se reabre.
 */
@Injectable()
export class AsistenciaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly identity: IdentityCliente,
  ) {}

  async lista(tallerId: string, sesion: SesionActual): Promise<ListaAsistencia> {
    const taller = await this.tallerMio(tallerId, sesion);
    return this.aLista(taller);
  }

  /**
   * Guarda las marcas y, si se lo piden, cierra.
   *
   * Guardar y cerrar van en la misma llamada pero con una bandera aparte: pasar lista con el
   * taller recién terminado no puede volverse irreversible por un clic de más.
   */
  async marcar(
    tallerId: string,
    entrada: MarcarAsistenciaInput,
    sesion: SesionActual,
  ): Promise<ResultadoCierreAsistencia> {
    const empresaId = this.empresaDe(sesion);
    const taller = await this.tallerMio(tallerId, sesion);

    if (taller.finAt.getTime() > Date.now()) {
      throw new BadRequestException('Este taller todavía no termina');
    }
    if (taller.asistenciaCerradaAt) {
      throw new ConflictException('La lista de este taller ya está cerrada');
    }

    const inscritos = new Set(taller.inscripciones.map((fila) => fila.usuarioId));
    const ajenos = entrada.asistieron.filter((usuarioId) => !inscritos.has(usuarioId));
    if (ajenos.length > 0) {
      throw new BadRequestException('Hay personas en la lista que no están inscritas');
    }

    const asistieron = new Set(entrada.asistieron);
    const cuantosAsistieron = asistieron.size;
    const paraQuienEnsena = tokensDeQuienEnsena(inscritos.size, cuantosAsistieron);

    await this.prisma.$transaction(async (tx) => {
      await tx.inscripcion.updateMany({
        where: { tallerId, usuarioId: { in: [...asistieron] } },
        data: { asistio: true },
      });
      await tx.inscripcion.updateMany({
        where: { tallerId, usuarioId: { notIn: [...asistieron] } },
        data: { asistio: false },
      });

      if (!entrada.cerrar) return;

      await tx.taller.update({
        where: { id: tallerId },
        data: { asistenciaCerradaAt: new Date() },
      });

      // Los tokens nacen aquí y en ninguna otra parte. `skipDuplicates` más la clave única
      // sobre (taller, persona, motivo) hacen que repetir el cierre no reparta de nuevo.
      const base = tokensDeQuienEnsena(inscritos.size, cuantosAsistieron);
      const extra = cuantosAsistieron > 0 && cuantosAsistieron === inscritos.size;
      await tx.token.createMany({
        data: [
          ...(base > 0
            ? [
                {
                  empresaId,
                  usuarioId: taller.capacitadorId,
                  tallerId,
                  motivo: 'DICTAR_TALLER' as const,
                  cantidad: base - (extra ? TOKENS_POR_ASISTENCIA_COMPLETA : 0),
                },
              ]
            : []),
          ...(extra
            ? [
                {
                  empresaId,
                  usuarioId: taller.capacitadorId,
                  tallerId,
                  motivo: 'ASISTENCIA_COMPLETA' as const,
                  cantidad: TOKENS_POR_ASISTENCIA_COMPLETA,
                },
              ]
            : []),
          ...[...asistieron].map((usuarioId) => ({
            empresaId,
            usuarioId,
            tallerId,
            motivo: 'ASISTIR' as const,
            cantidad: TOKENS_POR_ASISTIR,
          })),
        ],
        skipDuplicates: true,
      });
    });

    await this.auditoria.registrar({
      accion: entrada.cerrar ? 'ACTUALIZAR' : 'LEER',
      entidad: 'Asistencia',
      entidadId: tallerId,
      actorId: sesion.usuarioId,
      actorRol: sesion.roles[0] ?? null,
      empresaId,
      camposModificados: entrada.cerrar
        ? ['asistio', 'asistenciaCerradaAt', 'tokens']
        : ['asistio'],
      ip: sesion.ip,
    });

    const actualizado = await this.tallerMio(tallerId, sesion);
    return {
      lista: await this.aLista(actualizado),
      tokensParaQuienEnsena: entrada.cerrar ? paraQuienEnsena : 0,
      personasQueGanaronToken: entrada.cerrar ? cuantosAsistieron : 0,
    };
  }

  /** El taller tiene que ser de esta empresa **y dictado por quien pregunta**. */
  private async tallerMio(tallerId: string, sesion: SesionActual): Promise<TallerConInscritos> {
    this.empresaDe(sesion);

    const taller = await this.prisma.acotado.taller.findFirst({
      where: { id: tallerId, capacitadorId: sesion.usuarioId },
      select: {
        id: true,
        nombre: true,
        capacitadorId: true,
        finAt: true,
        asistenciaCerradaAt: true,
        inscripciones: { select: { usuarioId: true, asistio: true } },
      },
    });

    // 404 y no 403: un 403 confirmaría que el taller existe, y quién dicta qué no es asunto de
    // quien no lo dicta.
    if (!taller) {
      throw new NotFoundException('No dictas ningún taller con ese identificador');
    }
    return taller;
  }

  private async aLista(taller: TallerConInscritos): Promise<ListaAsistencia> {
    const personas = await this.identity.contactosPorIds(
      taller.inscripciones.map((fila) => fila.usuarioId),
    );

    const inscritos: InscritoEnLista[] = taller.inscripciones
      .map((fila) => {
        const persona = personas.get(fila.usuarioId);
        return {
          usuarioId: fila.usuarioId,
          // Si identity no la devuelve, la cuenta se anonimizó (Ley 21.719): la inscripción
          // sigue contando para el cupo, pero ya no dice quién era.
          nombre:
            [persona?.nombre, persona?.apellido].filter(Boolean).join(' ').trim() ||
            'Cuenta eliminada',
          email: persona?.email ?? '',
          asistio: fila.asistio,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const marcados = inscritos.filter((fila) => fila.asistio === true).length;

    return {
      tallerId: taller.id,
      tallerNombre: taller.nombre,
      termino: taller.finAt.getTime() < Date.now(),
      cerradaAt: taller.asistenciaCerradaAt?.toISOString() ?? null,
      inscritos,
      tokensSiCierra: tokensDeQuienEnsena(inscritos.length, marcados),
    };
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Esta acción es de los colaboradores de una empresa');
    }
    return sesion.empresaId;
  }
}
