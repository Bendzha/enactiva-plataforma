import { z } from 'zod';

/**
 * Solicitudes a RRHH (SPEC §2, reunión del 2026-10-29).
 *
 * Desde que el catálogo de temas es solo de RRHH, quien enseña necesita una forma de pedir lo que
 * antes hacía solo. Son **dos asuntos separados** por decisión de la clienta: *"sobre los roles que
 * sean asuntos separados, no que puedan haber 2 en una solicitud"*.
 */
export const TIPOS_SOLICITUD = ['PROPUESTA_TALLER', 'CAMBIO_DE_ROL'] as const;
export type TipoSolicitud = (typeof TIPOS_SOLICITUD)[number];

export const ESTADOS_SOLICITUD = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const ETIQUETAS_TIPO_SOLICITUD: Record<TipoSolicitud, string> = {
  PROPUESTA_TALLER: 'Propuesta de taller',
  CAMBIO_DE_ROL: 'Quiere enseñar',
};

export const ETIQUETAS_ESTADO_SOLICITUD: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
};

export const LARGO_MAXIMO_TEMA_PROPUESTO = 80;
export const LARGO_MAXIMO_DETALLE = 600;
export const LARGO_MAXIMO_MOTIVO_RECHAZO = 300;

/**
 * Proponer un taller sobre un tema que no está en el catálogo.
 *
 * El tema va como **texto libre** y no como id: el sentido de la solicitud es justamente que ese
 * tema todavía no existe. RRHH lo crea después, si aprueba.
 */
export const proponerTallerSchema = z.object({
  tema: z
    .string()
    .trim()
    .min(2, 'Escribe el tema del taller')
    .max(LARGO_MAXIMO_TEMA_PROPUESTO, `Máximo ${LARGO_MAXIMO_TEMA_PROPUESTO} caracteres`),
  detalle: z
    .string()
    .trim()
    .max(LARGO_MAXIMO_DETALLE, `Máximo ${LARGO_MAXIMO_DETALLE} caracteres`)
    .default(''),
});
export type ProponerTallerInput = z.infer<typeof proponerTallerSchema>;

/** Pedirle a RRHH el rol de quien enseña. No lleva tema: no es una propuesta de taller. */
export const pedirRolEnsenarSchema = z.object({
  detalle: z
    .string()
    .trim()
    .max(LARGO_MAXIMO_DETALLE, `Máximo ${LARGO_MAXIMO_DETALLE} caracteres`)
    .default(''),
});
export type PedirRolEnsenarInput = z.infer<typeof pedirRolEnsenarSchema>;

/** El motivo es opcional: la clienta dijo que se puede rechazar «con motivo o sin motivo». */
export const rechazarSolicitudSchema = z.object({
  motivo: z
    .string()
    .trim()
    .max(LARGO_MAXIMO_MOTIVO_RECHAZO, `Máximo ${LARGO_MAXIMO_MOTIVO_RECHAZO} caracteres`)
    .optional(),
});
export type RechazarSolicitudInput = z.infer<typeof rechazarSolicitudSchema>;

/** Lo que ve quien la pidió, en «Mi perfil». */
export interface MiSolicitud {
  id: string;
  tipo: TipoSolicitud;
  estado: EstadoSolicitud;
  tema: string | null;
  detalle: string;
  motivoRechazo: string | null;
  createdAt: string;
  resueltaAt: string | null;
}

/** Lo que ve RRHH en su bandeja. Lleva el nombre de quien pide, que es de su empresa. */
export interface SolicitudParaRrhh extends MiSolicitud {
  solicitante: {
    id: string;
    nombre: string | null;
    apellido: string | null;
    email: string | null;
  };
  resueltaPor: string | null;
}
