import { z } from 'zod';
import { emailSchema } from './auth.js';
import type { Dimension, NivelAdmin, NivelDominio, Rol, TipoInteres } from './enums.js';
import { aceptarInvitacionSchema } from './invitaciones.js';
import type { UsuarioSesion } from './sesion.js';

/**
 * Contratos de las llamadas ENTRE servicios (ADR-0007). No los usa el navegador.
 *
 * Viven aquí, y no duplicados en cada servicio, porque son un acuerdo entre dos partes: si auth
 * y identity se desincronizan, el login deja de funcionar y el error aparece en tiempo de
 * ejecución, no al compilar.
 */

/** Prefijo de todas las rutas internas. El gateway nunca las expone hacia afuera. */
export const PREFIJO_INTERNO = 'interno';

/** Cabecera con el secreto compartido entre servicios, para las rutas previas al login. */
export const CABECERA_INTERNO = 'x-interno-secreto';

/**
 * Lo que identity-service devuelve cuando una sesión queda establecida: quién es la persona y
 * el token de refresh en claro, que se entrega una sola vez para ponerlo en la cookie. El hash
 * queda guardado en identity_db; el pepper nunca sale de ese servicio.
 */
export interface SesionEstablecida {
  usuario: UsuarioSesion;
  refreshToken: string;
  refreshExpiraAt: string;
}

export const loginInternoSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  ip: z.string().nullable().optional(),
});
export type LoginInternoInput = z.infer<typeof loginInternoSchema>;

export const refrescarInternoSchema = z.object({
  token: z.string().min(1),
  ip: z.string().nullable().optional(),
});
export type RefrescarInternoInput = z.infer<typeof refrescarInternoSchema>;

export const cerrarSesionInternaSchema = z.object({
  token: z.string().min(1),
});
export type CerrarSesionInternaInput = z.infer<typeof cerrarSesionInternaSchema>;

export const aceptarInvitacionInternaSchema = aceptarInvitacionSchema.extend({
  ip: z.string().nullable().optional(),
});
export type AceptarInvitacionInternaInput = z.infer<typeof aceptarInvitacionInternaSchema>;

/**
 * Estado real de la persona que cada servicio consulta y cachea 30 s (ADR-0007, decisión D2).
 *
 * Deliberadamente no trae nombre ni email: learning-service y matching-service no necesitan
 * datos personales para decidir permisos, y no tiene sentido que los guarden en memoria
 * (minimización, Ley 21.719).
 */
export interface EstadoSesionInterno {
  usuarioId: string;
  roles: Rol[];
  nivelAdmin: NivelAdmin | null;
  empresaId: string | null;
  activo: boolean;
}

/**
 * Tema del catálogo, tal como lo ve otro servicio. Solo el id y el nombre: learning-service
 * guarda `temaId` y necesita el nombre para mostrarlo, nada más (ADR-0007).
 */
export interface TemaInterno {
  id: string;
  nombre: string;
}

/** Cuántos temas se piden de una vez; es el largo de una lista de talleres en pantalla. */
export const MAXIMO_TEMAS_INTERNOS = 100;

/**
 * Lo que matching-service necesita saber de las personas para armar el mazo (ADR-0007).
 *
 * Trae nombre, cargo y área porque la tarjeta del swipe muestra **quién** dicta el taller: sin
 * eso la persona no tiene cómo decidir. No trae email ni nada que no se vea en la tarjeta.
 */
export interface PersonaInterna {
  id: string;
  nombre: string | null;
  apellido: string | null;
  cargo: string | null;
  areaId: string | null;
  areaNombre: string | null;
}

/** Una declaración del perfil, como la ve otro servicio. */
export interface DeclaracionInterna {
  usuarioId: string;
  temaId: string;
  tipo: TipoInteres;
  dimensiones: Dimension[];
  nivel: NivelDominio;
}

/** Todo lo que identity responde de una vez para que matching pueda calcular la afinidad. */
export interface ContextoAfinidad {
  personas: PersonaInterna[];
  declaraciones: DeclaracionInterna[];
  temas: TemaInterno[];
}

/**
 * Un taller al que esta persona **podría** entrar, según learning-service: de su empresa, que
 * todavía no ocurre, con cupo libre, que no dicta ella y en el que no está inscrita.
 *
 * El filtro lo hace learning y no matching a propósito: las reglas del cupo y de la fecha son
 * del servicio que es dueño del taller.
 */
export interface TallerAbierto {
  id: string;
  temaId: string;
  capacitadorId: string;
  nombre: string;
  objetivo: string;
  resultadosEsperados: string;
  ubicacion: string;
  inicioAt: string;
  finAt: string;
  cupo: number;
  inscritos: number;
}

/**
 * Lo mínimo para mandarle un correo a alguien: a dónde y cómo saludarlo.
 *
 * Lo pide learning-service para los recordatorios de taller. Va por la ruta protegida con el
 * secreto compartido y **no con el token de una persona**, porque quien la llama es un reloj:
 * a las 9 de la mañana no hay nadie conectado que preste su sesión.
 */
export interface DestinatarioInterno {
  id: string;
  email: string;
  nombre: string | null;
}
