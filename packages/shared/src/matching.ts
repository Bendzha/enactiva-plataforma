import { z } from 'zod';

/**
 * El mazo del swipe y sus decisiones (SPEC §3.6).
 *
 * Es el corazón del producto según el acta del 2026-09-29: "Activa facilitará matches
 * corporativos entre colaboradores".
 */

/** Una tarjeta del mazo: un taller convocado y quién lo dicta. */
export interface TarjetaMazo {
  tallerId: string;
  temaId: string;
  temaNombre: string;
  nombre: string;
  objetivo: string;
  resultadosEsperados: string;
  ubicacion: string;
  inicioAt: string;
  finAt: string;
  cupo: number;
  inscritos: number;
  cuposDisponibles: number;
  /** Quién lo dicta: lo que la persona necesita para decidir si va. */
  facilitador: {
    id: string;
    nombre: string;
    cargo: string | null;
    area: string | null;
    /** Si trabaja en la misma área de quien mira la tarjeta. */
    mismaArea: boolean;
  };
  /** De 0 a 100. Es lo que ordena el mazo. */
  score: number;
  /** Por qué aparece aquí, en una línea, para que el orden no sea una caja negra. */
  porQue: string;
}

export const DECISIONES_MAZO = ['INTERESADO', 'DESCARTADO'] as const;
export type DecisionMazo = (typeof DECISIONES_MAZO)[number];

export const decidirSchema = z.object({
  decision: z.enum(DECISIONES_MAZO),
});
export type DecidirInput = z.infer<typeof decidirSchema>;

export interface ResultadoDecision {
  decision: DecisionMazo;
  /** Verdadero cuando el like dejó a la persona inscrita en el taller. */
  inscrito: boolean;
  /** Qué decir en pantalla: el cupo pudo llenarse entre que se armó el mazo y el like. */
  mensaje: string;
}

/**
 * Puntuación del match (SPEC §3.5, ADR-0009).
 *
 * Las cuatro preguntas son textuales del WhatsApp de la clienta del 2026-09-29. Miden si el
 * **emparejamiento** funcionó, que es otra cosa que si el taller estuvo bueno: un match puede
 * fallar —nunca se reunieron— sin que el taller sea malo, y al revés. Por eso se guardan aparte
 * de las estrellas.
 */
export const PREGUNTAS_MATCH = [
  'seReunieron',
  'aLaHoraAcordada',
  'comoLoEsperaban',
  'repetirian',
] as const;
export type PreguntaMatch = (typeof PREGUNTAS_MATCH)[number];

export const ETIQUETAS_PREGUNTA_MATCH: Record<PreguntaMatch, string> = {
  seReunieron: '¿Se reunieron?',
  aLaHoraAcordada: '¿Lograron reunirse en el día y hora acordados?',
  comoLoEsperaban: '¿La actividad fue como se la imaginaron?',
  repetirian: '¿Volverían a hacer match con esa persona?',
};

export const puntuarMatchSchema = z.object({
  seReunieron: z.boolean(),
  aLaHoraAcordada: z.boolean(),
  comoLoEsperaban: z.boolean(),
  repetirian: z.boolean(),
});
export type PuntuarMatchInput = z.infer<typeof puntuarMatchSchema>;

/** Lo que una de las dos partes respondió sobre un match. */
export interface RespuestaPuntuacionMatch {
  autorId: string;
  /** 'ESTUDIANTE' si la respondió quien fue a aprender, 'CAPACITADOR' si quien enseñó. */
  papel: 'ESTUDIANTE' | 'CAPACITADOR';
  seReunieron: boolean;
  aLaHoraAcordada: boolean;
  comoLoEsperaban: boolean;
  repetirian: boolean;
  createdAt: string;
}

/**
 * Un match y lo que dijeron de él.
 *
 * `respuestas` puede traer una sola: si solo contesta una parte, el match igual queda puntuado
 * con esa respuesta, porque la otra no puede dejar a nadie esperando (Q15).
 */
export interface MatchPuntuado {
  tallerId: string;
  tallerNombre: string;
  estudianteId: string;
  capacitadorId: string;
  respuestas: RespuestaPuntuacionMatch[];
}

/** Lo que RRHH ve en su panel: si los matches de su empresa funcionaron (SPEC §3.5). */
export interface MetricasDeMatches {
  matchesConRespuesta: number;
  /** De los que contestaron, cuántos dicen que sí a cada pregunta. */
  seReunieron: number;
  aLaHoraAcordada: number;
  comoLoEsperaban: number;
  repetirian: number;
}
