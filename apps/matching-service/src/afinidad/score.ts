import type { Dimension, NivelDominio } from '@enactiva/shared';

/**
 * Score de afinidad entre una persona y un taller convocado (SPEC §3.6).
 *
 * Responde una sola pregunta: **de todo lo que esta persona podría ver hoy, qué le sirve más**.
 * No es una recomendación con aprendizaje automático: es una suma de criterios que se pueden
 * explicar en voz alta, y eso es a propósito. Si alguien pregunta por qué le apareció un taller
 * primero, la respuesta tiene que caber en una frase.
 *
 * La clienta confirmó los criterios y que los pesos **parten iguales** y se ajustan con datos
 * reales. Por eso viven aquí, en constantes, y no en la base: cambiarlos es una decisión del
 * equipo con la clienta, no una configuración que alguien toca sin que nadie se entere.
 */

/** Lo que la persona que mira el mazo declaró sobre el tema del taller. */
export interface LoQueQuiereAprender {
  dimensiones: readonly Dimension[];
  nivel: NivelDominio;
}

/** Lo que declaró quien dicta el taller, sobre ese mismo tema. */
export interface LoQuePuedeEnsenar {
  dimensiones: readonly Dimension[];
  nivel: NivelDominio;
}

export interface EntradaAfinidad {
  /** Null si la persona nunca declaró ese tema: el taller igual aparece, pero más abajo. */
  quiereAprender: LoQueQuiereAprender | null;
  /** Null si quien dicta no declaró el tema en su perfil (puede pasar: publicar no exige declarar). */
  puedeEnsenar: LoQuePuedeEnsenar | null;
  mismaArea: boolean;
  /**
   * Promedio de estrellas del facilitador, de 1 a 5, o null si todavía nadie lo valoró.
   * Llega con el Slice 8; hasta entonces siempre es null y el criterio no suma ni resta.
   */
  valoracionFacilitador: number | null;
}

export interface Afinidad {
  /** De 0 a 100, redondeado. Es lo que ordena el mazo y lo que se guarda en el Match. */
  score: number;
  /** Por qué dio eso, criterio por criterio. Para poder explicarlo y para los tests. */
  detalle: Record<CriterioAfinidad, number>;
}

export type CriterioAfinidad = 'dimensiones' | 'nivel' | 'area' | 'valoracion';

/**
 * Pesos iniciales **iguales**, como pidió la clienta. Suman 1 entre los criterios que se pueden
 * calcular hoy; cuando llegue la valoración (Slice 8) pasan a ser cuatro cuartos sin tocar nada
 * más, porque el reparto se hace sobre los criterios disponibles.
 */
export const PESOS: Record<CriterioAfinidad, number> = {
  dimensiones: 1,
  nivel: 1,
  area: 1,
  valoracion: 1,
};

/**
 * Cuánto suma estar en la misma área.
 *
 * **Es un supuesto nuestro, no una decisión de la clienta** (SPEC §3.6, marcado `[S]`). La misma
 * área se coordina más fácil; pero el acta del 2026-09-29 habla de "fortalecer las relaciones y
 * la cultura organizacional", que es justamente lo que pasa cuando se cruzan áreas distintas.
 * Está preguntado. Para invertirlo basta poner este valor en 0 y el de abajo en 1.
 */
export const PUNTAJE_MISMA_AREA = 1;
export const PUNTAJE_OTRA_AREA = 0;

const ORDEN_NIVEL: Record<NivelDominio, number> = {
  BASICO: 1,
  INTERMEDIO: 2,
  AVANZADO: 3,
};

/**
 * Cuánto de lo que la persona quiere aprender cubre quien enseña.
 *
 * Se mide sobre lo que **pide** quien aprende, no sobre la unión de ambos: que el facilitador
 * ofrezca además otra dimensión no es un defecto, y penalizarlo sería castigar a quien sabe más.
 */
function puntajeDimensiones(entrada: EntradaAfinidad): number {
  const { quiereAprender, puedeEnsenar } = entrada;
  if (!quiereAprender || !puedeEnsenar || quiereAprender.dimensiones.length === 0) {
    return 0;
  }

  const ofrecidas = new Set<Dimension>(puedeEnsenar.dimensiones);
  const cubiertas = quiereAprender.dimensiones.filter((dimension) => ofrecidas.has(dimension));
  return cubiertas.length / quiereAprender.dimensiones.length;
}

/**
 * Qué tan bien calza el nivel.
 *
 * Aprender de alguien que está por encima es lo que buscamos; del mismo nivel sirve a medias;
 * de alguien por debajo, no. Los tres valores son del equipo **[P]**: la clienta confirmó que
 * el nivel es un criterio, no cuánto pesa cada caso.
 */
function puntajeNivel(entrada: EntradaAfinidad): number {
  const { quiereAprender, puedeEnsenar } = entrada;
  if (!quiereAprender || !puedeEnsenar) {
    return 0;
  }

  const diferencia = ORDEN_NIVEL[puedeEnsenar.nivel] - ORDEN_NIVEL[quiereAprender.nivel];
  if (diferencia > 0) return 1;
  if (diferencia === 0) return 0.6;
  return 0;
}

/** De 1 a 5 estrellas a una escala de 0 a 1. Sin valoraciones, el criterio no participa. */
function puntajeValoracion(entrada: EntradaAfinidad): number | null {
  const promedio = entrada.valoracionFacilitador;
  if (promedio === null) return null;

  const acotado = Math.min(5, Math.max(1, promedio));
  return (acotado - 1) / 4;
}

/**
 * Calcula la afinidad. Función pura: las mismas entradas dan siempre el mismo número, que es lo
 * que permite probarla sin base de datos y explicar cualquier resultado después.
 */
export function calcularAfinidad(entrada: EntradaAfinidad): Afinidad {
  const valoracion = puntajeValoracion(entrada);

  const puntajes: Record<CriterioAfinidad, number | null> = {
    dimensiones: puntajeDimensiones(entrada),
    nivel: puntajeNivel(entrada),
    area: entrada.mismaArea ? PUNTAJE_MISMA_AREA : PUNTAJE_OTRA_AREA,
    valoracion,
  };

  let acumulado = 0;
  let pesoTotal = 0;
  const detalle = {} as Record<CriterioAfinidad, number>;

  for (const criterio of Object.keys(puntajes) as CriterioAfinidad[]) {
    const puntaje = puntajes[criterio];
    // Un criterio que todavía no existe no cuenta: reparte su peso entre los demás en vez de
    // arrastrar a todo el mundo hacia abajo con un cero que no significa nada.
    if (puntaje === null) continue;

    detalle[criterio] = Math.round(puntaje * 100) / 100;
    acumulado += puntaje * PESOS[criterio];
    pesoTotal += PESOS[criterio];
  }

  return {
    score: pesoTotal === 0 ? 0 : Math.round((acumulado / pesoTotal) * 100),
    detalle,
  };
}
