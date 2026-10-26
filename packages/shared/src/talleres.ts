import { z } from 'zod';
import { DIAS_SEMANA, type DiaSemana } from './enums.js';

/**
 * Talleres convocados y disponibilidad del facilitador (SPEC §3.2, acta 2026-09-29).
 *
 * La plataforma no aloja la clase: publica una **ficha** con lo que alguien necesita para decidir
 * si va, y la actividad ocurre en persona (ADR-0008). Desde el 2026-10-13 el taller es una
 * actividad única, sin etapas (ADR-0010).
 */

export const MAXIMO_CUPO = 500;

/** Hora del día en formato HH:MM de 24 horas, con cero a la izquierda. */
export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM, por ejemplo 09:30');

const fichaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'Ponle un nombre al taller')
    .max(120, 'El nombre es demasiado largo'),
  objetivo: z
    .string()
    .trim()
    .min(10, 'Cuenta en una línea para qué es el taller')
    .max(500, 'El objetivo es demasiado largo'),
  resultadosEsperados: z
    .string()
    .trim()
    .min(10, 'Di qué se va a llevar quien asista')
    .max(500, 'Es demasiado largo'),
  /** La actividad es presencial: sin lugar, nadie llega (acta 2026-09-29). */
  ubicacion: z
    .string()
    .trim()
    .min(3, 'Indica dónde se hace')
    .max(200, 'La ubicación es demasiado larga'),
  inicioAt: z.iso.datetime({ message: 'Fecha y hora de inicio inválidas' }),
  finAt: z.iso.datetime({ message: 'Fecha y hora de término inválidas' }),
  cupo: z.coerce
    .number()
    .int('El cupo es un número entero')
    .min(1, 'El cupo mínimo es 1')
    .max(MAXIMO_CUPO, `El cupo máximo es ${MAXIMO_CUPO}`),
});

const terminaDespues = (datos: { inicioAt: string; finAt: string }) =>
  new Date(datos.finAt).getTime() > new Date(datos.inicioAt).getTime();

export const crearTallerSchema = fichaSchema
  .extend({
    /** Tema del catálogo de la empresa (vive en identity-service, ADR-0007). */
    temaId: z.uuid('Elige un tema del catálogo'),
  })
  .refine(terminaDespues, {
    message: 'El taller no puede terminar antes de empezar',
    path: ['finAt'],
  });
export type CrearTallerInput = z.infer<typeof crearTallerSchema>;

/**
 * Al editar no se cambia el tema: quien se inscribió lo hizo por ese tema, y cambiarlo debajo
 * sería otra cosa con el mismo nombre.
 */
export const editarTallerSchema = fichaSchema.refine(terminaDespues, {
  message: 'El taller no puede terminar antes de empezar',
  path: ['finAt'],
});
export type EditarTallerInput = z.infer<typeof editarTallerSchema>;

export interface TallerResumen {
  id: string;
  temaId: string;
  /** Lo resuelve learning-service preguntándole a identity, que es dueño del catálogo. */
  temaNombre: string;
  capacitadorId: string;
  nombre: string;
  objetivo: string;
  resultadosEsperados: string;
  ubicacion: string;
  inicioAt: string;
  finAt: string;
  cupo: number;
  inscritos: number;
  cuposDisponibles: number;
  /** Ya empezó: no admite inscripciones ni ediciones. */
  empezado: boolean;
  /** Si quien pregunta lo dicta. */
  esMio: boolean;
  /** Si quien pregunta ya está inscrito. */
  inscrito: boolean;
}

/** Una franja en la que alguien puede enseñar. Se repite todas las semanas. */
export interface FranjaDisponibilidad {
  dia: DiaSemana;
  horaInicio: string;
  horaFin: string;
}

export const franjaSchema = z
  .object({
    dia: z.enum(DIAS_SEMANA),
    horaInicio: horaSchema,
    horaFin: horaSchema,
  })
  .refine((franja) => franja.horaFin > franja.horaInicio, {
    message: 'La hora de término va después de la de inicio',
    path: ['horaFin'],
  });

export const MAXIMO_FRANJAS = 21;

/**
 * La disponibilidad se guarda completa, no franja por franja: quien la edita ve toda su semana,
 * y mandar la lista entera evita quedar a medio camino entre dos estados.
 */
export const guardarDisponibilidadSchema = z.object({
  franjas: z
    .array(franjaSchema)
    .max(MAXIMO_FRANJAS, 'Son demasiadas franjas')
    .refine(
      (franjas) =>
        new Set(franjas.map((f) => `${f.dia}|${f.horaInicio}|${f.horaFin}`)).size ===
        franjas.length,
      'Hay franjas repetidas',
    ),
});
export type GuardarDisponibilidadInput = z.infer<typeof guardarDisponibilidadSchema>;

/** Un taller en la agenda de alguien, con el papel que tiene en él. */
export interface ItemAgenda {
  tallerId: string;
  temaNombre: string;
  nombre: string;
  ubicacion: string;
  inicioAt: string;
  finAt: string;
  /** Si lo dicta o si va a asistir. */
  papel: 'DICTO' | 'VOY';
  inscritos: number;
  cupo: number;
  /**
   * Si esta persona todavía puede valorar este taller (SPEC §3.5).
   *
   * Lo decide learning y no la pantalla, porque son tres condiciones suyas: que el taller haya
   * terminado, que ella fuera a aprender —nadie valora lo que dictó— y que no lo haya valorado
   * ya. Resolverlo aquí evita una consulta por fila en la agenda.
   */
  puedeValorar: boolean;
}

/**
 * Lo que viene primero, porque es a lo que uno entra a mirar; el historial abajo, porque es
 * donde cuelga la valoración del encuentro (SPEC §3.5).
 */
export interface Agenda {
  proximos: ItemAgenda[];
  pasados: ItemAgenda[];
}
