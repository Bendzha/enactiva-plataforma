import { z } from 'zod';
import { emailSchema } from './auth.js';
import type { NivelAdmin, Rol } from './enums.js';
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
