import { z } from 'zod';
import { emailSchema } from './auth.js';
import { NIVELES_ADMIN, type EstadoUsuario, type NivelAdmin } from './enums.js';

/** Integrante del equipo ENACTIVA con acceso de administración. */
export interface AdminResumen {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  nivelAdmin: NivelAdmin;
  estado: EstadoUsuario;
  /** Null si ya activó su cuenta o si la invitación fue revocada. */
  invitacionExpiraAt: string | null;
}

export const crearAdminSchema = z.object({
  email: emailSchema,
  nivelAdmin: z.enum(NIVELES_ADMIN),
});
export type CrearAdminInput = z.infer<typeof crearAdminSchema>;

export const ETIQUETAS_NIVEL_ADMIN: Record<NivelAdmin, string> = {
  PRINCIPAL: 'Principal',
  OPERATIVO: 'Operativo',
};
