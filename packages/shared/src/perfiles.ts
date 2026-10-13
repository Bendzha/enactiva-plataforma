import { z } from 'zod';
import {
  DIMENSIONES,
  NIVELES_DOMINIO,
  TIPOS_INTERES,
  type Dimension,
  type NivelDominio,
  type TipoInteres,
} from './enums.js';

/**
 * Catálogo de temas y perfil corporativo (SPEC §3.6, acta 2026-09-29).
 *
 * El perfil guarda lo que la persona declara **sobre su trabajo**: qué puede enseñar, qué quiere
 * aprender y sus intereses generales. La clienta pidió expresamente limitar la información
 * personal, así que no hay biografía, foto, teléfono ni nada parecido (Ley 21.719, minimización).
 */

/** Cuántos temas devuelve el buscador: suficientes para elegir, pocos para no dar una lista infinita. */
export const MAXIMO_TEMAS_SUGERIDOS = 20;

export interface TemaResumen {
  id: string;
  nombre: string;
  /** Cuánta gente de la empresa declaró que puede enseñarlo. */
  puedenEnsenar: number;
  /** Cuánta gente de la empresa declaró que quiere aprenderlo. */
  quierenAprender: number;
}

export const buscarTemasSchema = z.object({
  buscar: z.string().trim().max(80, 'La búsqueda es demasiado larga').optional(),
});
export type BuscarTemasInput = z.infer<typeof buscarTemasSchema>;

export const crearTemaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre del tema es obligatorio')
    .max(80, 'El nombre es demasiado largo'),
  /**
   * Solo lo manda el equipo de ENACTIVA, que no pertenece a ninguna empresa. Para el resto la
   * empresa sale de la sesión verificada y este campo se rechaza (ADR-0007).
   */
  empresaId: z.uuid('Empresa inválida').optional(),
});
export type CrearTemaInput = z.infer<typeof crearTemaSchema>;

const dimensionesSchema = z
  .array(z.enum(DIMENSIONES))
  .min(1, 'Elige al menos una dimensión')
  .refine((ds) => new Set(ds).size === ds.length, 'No repitas la misma dimensión');

export const declararInteresSchema = z.object({
  temaId: z.uuid('Tema inválido'),
  tipo: z.enum(TIPOS_INTERES),
  dimensiones: dimensionesSchema,
  nivel: z.enum(NIVELES_DOMINIO),
});
export type DeclararInteresInput = z.infer<typeof declararInteresSchema>;

/** Al editar una declaración solo cambian las dimensiones y el nivel: el tema y el tipo la identifican. */
export const editarInteresSchema = declararInteresSchema.pick({ dimensiones: true, nivel: true });
export type EditarInteresInput = z.infer<typeof editarInteresSchema>;

export interface InteresDeclarado {
  id: string;
  temaId: string;
  temaNombre: string;
  tipo: TipoInteres;
  dimensiones: Dimension[];
  nivel: NivelDominio;
}

export const MAXIMO_INTERESES_GENERALES = 300;

export const guardarPerfilSchema = z.object({
  /** Lo que la clienta llamó "intereses generales" en la reunión del 2026-09-29. */
  interesesGenerales: z
    .string()
    .trim()
    .max(MAXIMO_INTERESES_GENERALES, 'Son demasiados caracteres'),
});
export type GuardarPerfilInput = z.infer<typeof guardarPerfilSchema>;

export interface MiPerfil {
  usuarioId: string;
  nombre: string | null;
  apellido: string | null;
  /** Los datos del puesto los administra RRHH; aquí se muestran, no se editan. */
  cargo: string | null;
  areaNombre: string | null;
  interesesGenerales: string;
  puedoEnsenar: InteresDeclarado[];
  quieroAprender: InteresDeclarado[];
}
