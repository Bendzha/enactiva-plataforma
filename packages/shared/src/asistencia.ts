import { z } from 'zod';

/**
 * Lista de asistencia y tokens de reconocimiento (reunión 2026-10-29).
 *
 * Quien enseña pasa lista cuando el taller termina, y de esa lista salen los tokens: los suyos
 * y los de quienes fueron. Es la única fuente de verdad sobre quién asistió — antes cada
 * participante lo declaraba al valorar, y dos respuestas distintas a «¿fuiste?» dejaban el
 * recuento en disputa justo cuando el recuento empezó a valer algo fuera de la plataforma.
 */

/** Desde cuántos inscritos el taller vale el tramo alto. */
export const INSCRITOS_PARA_TRAMO_ALTO = 5;

/** Lo que recibe quien enseña por convocar y cerrar la lista. */
export const TOKENS_POR_DICTAR_POCOS = 2;
export const TOKENS_POR_DICTAR_MUCHOS = 3;

/** El extra de quien enseña cuando van **todos** los que se inscribieron. */
export const TOKENS_POR_ASISTENCIA_COMPLETA = 1;

/** Lo que recibe quien aprende por asistir. */
export const TOKENS_POR_ASISTIR = 1;

export const MOTIVOS_TOKEN = ['DICTAR_TALLER', 'ASISTENCIA_COMPLETA', 'ASISTIR'] as const;
export type MotivoToken = (typeof MOTIVOS_TOKEN)[number];

export const ETIQUETAS_MOTIVO_TOKEN: Record<MotivoToken, string> = {
  DICTAR_TALLER: 'Por dictar el taller',
  ASISTENCIA_COMPLETA: 'Porque fueron todos los inscritos',
  ASISTIR: 'Por asistir',
};

/**
 * Cuántos tokens gana quien dictó, según cuánta gente se inscribió y cuánta fue.
 *
 * Función pura y en `shared` para que el servidor la aplique y la pantalla pueda anticiparla
 * sin que los dos números se separen. Un taller **sin inscritos no da nada**: la regla de la
 * clienta («2 tokens si son menos de 5») habla de talleres que ocurrieron, y pagar por uno al
 * que no fue nadie convertiría el recuento en algo que se puede inflar publicando.
 */
export function tokensDeQuienEnsena(inscritos: number, asistieron: number): number {
  if (inscritos === 0) return 0;

  const base =
    inscritos < INSCRITOS_PARA_TRAMO_ALTO ? TOKENS_POR_DICTAR_POCOS : TOKENS_POR_DICTAR_MUCHOS;
  const completa = asistieron === inscritos ? TOKENS_POR_ASISTENCIA_COMPLETA : 0;
  return base + completa;
}

/** Una persona de la lista, como la ve quien dicta el taller. */
export interface InscritoEnLista {
  usuarioId: string;
  nombre: string;
  email: string;
  /** Null mientras quien dicta no haya pasado lista. */
  asistio: boolean | null;
}

/**
 * La lista completa de un taller. **Solo la ve quien lo dicta** (acta 2026-10-29): para el
 * resto, quiénes van a un taller no es información suya.
 */
export interface ListaAsistencia {
  tallerId: string;
  tallerNombre: string;
  /** Hasta que no termina, no hay nada que pasar. */
  termino: boolean;
  /** Una vez cerrada no se reabre: de ella salieron tokens que ya están entregados. */
  cerradaAt: string | null;
  inscritos: InscritoEnLista[];
  /** Lo que ganaría quien dicta si cerrara la lista como está ahora. */
  tokensSiCierra: number;
}

export const marcarAsistenciaSchema = z.object({
  /** Los que sí fueron. Quien no esté en la lista queda marcado como ausente. */
  asistieron: z.array(z.uuid()),
  /**
   * Cerrar entrega los tokens y congela la lista. Se manda aparte del guardado para que pasar
   * lista con el curso recién terminado no sea irreversible por accidente.
   */
  cerrar: z.boolean().default(false),
});
export type MarcarAsistenciaInput = z.infer<typeof marcarAsistenciaSchema>;

/** Lo que se devuelve al cerrar: qué se repartió y a quién, para poder decirlo en pantalla. */
export interface ResultadoCierreAsistencia {
  lista: ListaAsistencia;
  tokensParaQuienEnsena: number;
  personasQueGanaronToken: number;
}
