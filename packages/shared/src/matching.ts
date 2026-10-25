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
