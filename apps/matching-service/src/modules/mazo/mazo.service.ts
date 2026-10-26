import { ForbiddenException, Injectable } from '@nestjs/common';
import type {
  ContextoAfinidad,
  DeclaracionInterna,
  PersonaInterna,
  TallerAbierto,
  TarjetaMazo,
} from '@enactiva/shared';
import { type SesionActual } from '@enactiva/service-kit';
import { ClientesInternos } from '../../clientes.js';
import { calcularAfinidad, type EntradaAfinidad } from '../../afinidad/score.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Cuántas tarjetas devuelve el mazo de una vez. Nadie hace swipe a cincuenta cosas seguidas. */
export const MAXIMO_TARJETAS = 20;

/**
 * El mazo del swipe (SPEC §3.6).
 *
 * Se arma en cada consulta y no se guarda: un mazo guardado envejece solo —el cupo se llena, el
 * taller ocurre, alguien declara un interés nuevo— y mostraría tarjetas que ya no existen. Lo
 * único que se guarda es lo que la persona **decidió**.
 */
@Injectable()
export class MazoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientes: ClientesInternos,
  ) {}

  async paraMi(sesion: SesionActual, buscar?: string): Promise<TarjetaMazo[]> {
    this.empresaDe(sesion);

    const abiertos = await this.clientes.talleresAbiertos();
    if (abiertos.length === 0) return [];

    /**
     * Solo se esconde lo que la persona **descartó**: eso sí es una decisión suya de no verlo
     * más (SPEC §3.6).
     *
     * Un "me interesa" no se esconde aquí. La razón para no mostrarlo es que ya está inscrita,
     * y de eso sabe learning, que es quien lleva las inscripciones: si cancela, el taller vuelve
     * a estar abierto para ella y la tarjeta tiene que volver. Esconderlo desde este lado dejaba
     * talleres en el limbo: cancelabas y no aparecían en ninguna parte.
     */
    const descartados = await this.prisma.acotado.match.findMany({
      where: { estudianteId: sesion.usuarioId, decision: 'DESCARTADO' },
      select: { tallerId: true },
    });
    const sinInteres = new Set(descartados.map((match) => match.tallerId));
    const candidatos = abiertos.filter((taller) => !sinInteres.has(taller.id));
    if (candidatos.length === 0) return [];

    const capacitadores = candidatos.map((taller) => taller.capacitadorId);
    const [contexto, valoraciones] = await Promise.all([
      this.clientes.contextoAfinidad(
        [sesion.usuarioId, ...capacitadores],
        candidatos.map((taller) => taller.temaId),
      ),
      this.clientes.valoracionesDeFacilitadores(capacitadores),
    ]);

    const tarjetas = candidatos
      .map((taller) => this.aTarjeta(taller, contexto, valoraciones, sesion))
      .filter((tarjeta): tarjeta is TarjetaMazo => tarjeta !== null);

    const filtradas = this.filtrarPorTema(tarjetas, buscar);

    // Primero lo que más calza; a igual score, lo que ocurre antes: entre dos talleres parecidos
    // conviene el que está más cerca, porque es el que la persona puede agendar de verdad.
    return filtradas
      .sort((a, b) => b.score - a.score || a.inicioAt.localeCompare(b.inicioAt))
      .slice(0, MAXIMO_TARJETAS);
  }

  private aTarjeta(
    taller: TallerAbierto,
    contexto: ContextoAfinidad,
    valoraciones: Map<string, number | null>,
    sesion: SesionActual,
  ): TarjetaMazo | null {
    const facilitador = contexto.personas.find((persona) => persona.id === taller.capacitadorId);
    const yo = contexto.personas.find((persona) => persona.id === sesion.usuarioId);

    // Si identity no devolvió al facilitador, ese taller es de otra empresa o de alguien que ya
    // no está: la tarjeta no se arma. Es el acotado por empresa haciendo su trabajo.
    if (!facilitador) return null;

    const mismaArea =
      yo?.areaId != null && facilitador.areaId != null && yo.areaId === facilitador.areaId;

    const entrada: EntradaAfinidad = {
      quiereAprender: this.declaracion(contexto, sesion.usuarioId, taller.temaId, 'APRENDER'),
      puedeEnsenar: this.declaracion(contexto, taller.capacitadorId, taller.temaId, 'ENSENAR'),
      mismaArea,
      // Null mientras no junte suficientes valoraciones: el score reparte ese peso entre los
      // demás criterios en vez de castigar a quien recién empieza (ADR-0009).
      valoracionFacilitador: valoraciones.get(taller.capacitadorId) ?? null,
    };
    const { score } = calcularAfinidad(entrada);

    const temaNombre =
      contexto.temas.find((tema) => tema.id === taller.temaId)?.nombre ?? 'Tema no disponible';

    return {
      tallerId: taller.id,
      temaId: taller.temaId,
      temaNombre,
      nombre: taller.nombre,
      objetivo: taller.objetivo,
      resultadosEsperados: taller.resultadosEsperados,
      ubicacion: taller.ubicacion,
      inicioAt: taller.inicioAt,
      finAt: taller.finAt,
      cupo: taller.cupo,
      inscritos: taller.inscritos,
      cuposDisponibles: Math.max(0, taller.cupo - taller.inscritos),
      facilitador: {
        id: facilitador.id,
        nombre: this.nombreVisible(facilitador),
        cargo: facilitador.cargo,
        area: facilitador.areaNombre,
        mismaArea,
      },
      score,
      porQue: this.porQue(entrada, temaNombre),
    };
  }

  /**
   * Una línea que explica el orden. Si alguien pregunta por qué este taller salió primero, la
   * respuesta tiene que estar en la tarjeta y no en el código.
   */
  private porQue(entrada: EntradaAfinidad, temaNombre: string): string {
    const razones: string[] = [];

    if (entrada.quiereAprender && entrada.puedeEnsenar) {
      razones.push(`querías aprender ${temaNombre}`);
      if (entrada.puedeEnsenar.nivel !== entrada.quiereAprender.nivel) {
        razones.push('lo enseña alguien con más recorrido');
      }
    } else {
      razones.push(`es un tema que no habías declarado`);
    }

    if (entrada.mismaArea) {
      razones.push('trabaja en tu área');
    }

    if (entrada.valoracionFacilitador !== null && entrada.valoracionFacilitador >= 4) {
      razones.push('lo valoran bien quienes fueron');
    }

    return razones.join(' · ');
  }

  private nombreVisible(persona: PersonaInterna): string {
    return [persona.nombre, persona.apellido].filter(Boolean).join(' ') || 'Alguien de tu empresa';
  }

  private declaracion(
    contexto: ContextoAfinidad,
    usuarioId: string,
    temaId: string,
    tipo: DeclaracionInterna['tipo'],
  ) {
    const encontrada = contexto.declaraciones.find(
      (declaracion) =>
        declaracion.usuarioId === usuarioId &&
        declaracion.temaId === temaId &&
        declaracion.tipo === tipo,
    );
    return encontrada ? { dimensiones: encontrada.dimensiones, nivel: encontrada.nivel } : null;
  }

  /** El filtro por tema es opcional: el mazo ya viene ordenado por afinidad sin él. */
  private filtrarPorTema(tarjetas: TarjetaMazo[], buscar?: string): TarjetaMazo[] {
    const termino = buscar?.trim().toLowerCase();
    if (!termino) return tarjetas;

    const sinTildes = (texto: string) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const buscado = sinTildes(termino);
    return tarjetas.filter(
      (tarjeta) =>
        sinTildes(tarjeta.temaNombre).includes(buscado) ||
        sinTildes(tarjeta.nombre).includes(buscado),
    );
  }

  private empresaDe(sesion: SesionActual): string {
    if (!sesion.empresaId) {
      throw new ForbiddenException('Tu cuenta no está asociada a una empresa');
    }
    return sesion.empresaId;
  }
}
