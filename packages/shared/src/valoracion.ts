import { z } from 'zod';

/**
 * Valoración del encuentro, referencias y tokens (SPEC §3.5, ADR-0009).
 *
 * El segundo eje del producto, en palabras de la clienta: *"1. Match corporativo
 * 2. Gamificación corporativa"*. Mide **si el encuentro sirvió**, no cuánto aprendió alguien:
 * eso salió del alcance el 2026-10-13 (ADR-0010).
 */

/**
 * Las cuatro dimensiones del ejemplo que mandó la clienta, textuales.
 *
 * Van como **datos y no como columnas** porque ella dijo *"Son siempre esas 4, se pueden agrega o
 * cambiar en un futuro"* (Q16): sumar una quinta no puede ser una migración.
 */
export const DIMENSIONES_VALORACION = [
  'CLARIDAD',
  'SEGURIDAD',
  'APLICACION',
  'USO_DE_MATERIALES',
] as const;
export type DimensionValoracion = (typeof DIMENSIONES_VALORACION)[number];

/** Las preguntas se muestran tal como las escribió la clienta, no reformuladas. */
export const ETIQUETAS_DIMENSION_VALORACION: Record<DimensionValoracion, string> = {
  CLARIDAD: 'Claridad',
  SEGURIDAD: '¿Me sentí seguro en el taller?',
  APLICACION: 'Aplicación',
  USO_DE_MATERIALES: 'Uso de materiales',
};

export const ESTRELLAS_MINIMAS = 1;
export const ESTRELLAS_MAXIMAS = 5;
export const MAXIMO_REFERENCIA = 600;

/**
 * Desde cuántas valoraciones el promedio de alguien empieza a mover el orden de Descubrir.
 *
 * Con una o dos no cuenta y su peso se reparte entre los otros criterios. Es el remedio al
 * riesgo que dejó anotado el ADR-0009: sin esto, una sola opinión mala hunde a alguien en el
 * mazo para siempre, y quien empezó con mal pie no tiene cómo remontar.
 */
export const VALORACIONES_PARA_CONTAR_EN_EL_SCORE = 3;

const estrellasSchema = z
  .number()
  .int('Las estrellas son un número entero')
  .min(ESTRELLAS_MINIMAS, 'Da al menos una estrella')
  .max(ESTRELLAS_MAXIMAS, `El máximo es ${ESTRELLAS_MAXIMAS} estrellas`);

export const valorarTallerSchema = z.object({
  /** Las cuatro, completas: media valoración no sirve para promediar nada. */
  estrellas: z
    .record(z.enum(DIMENSIONES_VALORACION), estrellasSchema)
    .refine((dado) => DIMENSIONES_VALORACION.every((dimension) => dado[dimension] !== undefined), {
      message: 'Responde las cuatro preguntas',
    }),
  /** "Mi asistencia al taller ✅", en el ejemplo de la clienta: la marca quien asistió. */
  asistio: z.boolean(),
  /**
   * Opcional: la clienta la pidió, pero obligarla llenaría la base de referencias de relleno.
   * Vacía equivale a no dejar ninguna.
   */
  referencia: z
    .string()
    .trim()
    .max(MAXIMO_REFERENCIA, 'La referencia es demasiado larga')
    .default(''),
});
export type ValorarTallerInput = z.infer<typeof valorarTallerSchema>;

export interface EstrellasPorDimension {
  dimension: DimensionValoracion;
  estrellas: number;
}

/** Lo que una persona respondió sobre un taller. Solo lo ve quien lo escribió. */
export interface MiValoracion {
  tallerId: string;
  asistio: boolean;
  estrellas: EstrellasPorDimension[];
  referencia: string;
  createdAt: string;
}

/**
 * Las estrellas de un taller, ya promediadas.
 *
 * Nunca por persona: el detalle de quién puso qué no aporta nada y expone a quien valoró
 * (SPEC §3.5). La referencia sí va firmada, porque la clienta la quiso pública.
 */
export interface EstrellasDelTaller {
  tallerId: string;
  cuantasValoraciones: number;
  asistieron: number;
  promedioGeneral: number | null;
  promedioPorDimension: EstrellasPorDimension[];
}

/** Una referencia publicada dentro de la empresa, con el nombre de quien la escribió. */
export interface ReferenciaPublicada {
  id: string;
  tallerId: string;
  tallerNombre: string;
  capacitadorId: string;
  autorId: string;
  /** Lo resuelve learning preguntándole a identity, que es dueño de las personas. */
  autorNombre: string;
  texto: string;
  createdAt: string;
  /** Solo RRHH las ve ocultas; para el resto, una referencia oculta no existe. */
  oculta: boolean;
  motivoOcultada: string | null;
}

export const ocultarReferenciaSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(10, 'Explica por qué la ocultas: queda en el registro')
    .max(300, 'El motivo es demasiado largo'),
});
export type OcultarReferenciaInput = z.infer<typeof ocultarReferenciaSchema>;

/**
 * El reconocimiento de quien enseña: cuántos tokens tiene y por qué talleres.
 *
 * La plataforma lleva **el recuento y nada más**. El canje lo administra cada empresa fuera de
 * aquí (Q18), así que no hay saldo, premios ni transferencias.
 */
export interface ReconocimientoPersona {
  usuarioId: string;
  tokens: number;
  talleresDictados: number;
  cuantasValoraciones: number;
  /** Null hasta que alguien lo valore. */
  promedioEstrellas: number | null;
  /** Si todavía no mueve el orden de Descubrir, y cuánto le falta. */
  cuentaEnElScore: boolean;
}

/** Lo que matching le pide a learning para el cuarto criterio del score (ADR-0009). */
export interface ValoracionDeFacilitador {
  capacitadorId: string;
  /** Null mientras no llegue a VALORACIONES_PARA_CONTAR_EN_EL_SCORE. */
  promedio: number | null;
}
