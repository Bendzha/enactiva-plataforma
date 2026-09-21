import { z } from 'zod';
import { passwordNuevoSchema } from './auth.js';

/**
 * Versión del aviso de privacidad que la persona acepta al activar su cuenta.
 * El texto actual es un BORRADOR del equipo: ENACTIVA debe aprobar el definitivo
 * antes del piloto con datos reales (SPEC Q3). Al cambiar el texto, cambiar esta versión.
 */
export const AVISO_PRIVACIDAD_VERSION = '2026-09-borrador';

export const aceptarInvitacionSchema = z.object({
  token: z.string().min(20, 'El enlace de invitación no es válido'),
  nombre: z.string().trim().min(2, 'Tu nombre es obligatorio').max(80),
  apellido: z.string().trim().min(2, 'Tu apellido es obligatorio').max(80),
  password: passwordNuevoSchema,
  aceptaAviso: z.literal(true, 'Debes aceptar el aviso de privacidad para continuar'),
});
export type AceptarInvitacionInput = z.infer<typeof aceptarInvitacionSchema>;

/** Datos que se muestran antes de activar, para que la persona sepa qué cuenta está activando. */
export interface EstadoInvitacion {
  email: string;
  /** Null cuando se invita a alguien del equipo ENACTIVA. */
  nombreEmpresa: string | null;
  versionAviso: string;
}
