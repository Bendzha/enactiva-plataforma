import { z } from 'zod';
import { passwordNuevoSchema } from './auth.js';

/**
 * Las dos aceptaciones van por separado (SPEC §3.7, Q21).
 *
 * Una sola casilla para los dos documentos sería más cómoda y haría imposible demostrar después
 * qué aceptó cada persona.
 */
export const aceptarInvitacionSchema = z.object({
  token: z.string().min(20, 'El enlace de invitación no es válido'),
  nombre: z.string().trim().min(2, 'Tu nombre es obligatorio').max(80),
  apellido: z.string().trim().min(2, 'Tu apellido es obligatorio').max(80),
  password: passwordNuevoSchema,
  aceptaAviso: z.literal(true, 'Debes aceptar el aviso de privacidad para continuar'),
  aceptaTerminos: z.literal(true, 'Debes aceptar los términos y condiciones para continuar'),
});
export type AceptarInvitacionInput = z.infer<typeof aceptarInvitacionSchema>;

/** Datos que se muestran antes de activar, para que la persona sepa qué cuenta está activando. */
export interface EstadoInvitacion {
  email: string;
  /** Null cuando se invita a alguien del equipo ENACTIVA. */
  nombreEmpresa: string | null;
  versionAviso: string;
  versionTerminos: string;
}
