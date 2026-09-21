import { z } from 'zod';
import { emailSchema } from './auth.js';
import type { EstadoUsuario, Rol } from './enums.js';

/** Roles que RRHH puede asignar a la gente de su empresa. Los de ENACTIVA no se invitan desde aquí. */
export const ROLES_INVITABLES = ['ESTUDIANTE', 'CAPACITADOR'] as const;
export type RolInvitable = (typeof ROLES_INVITABLES)[number];

export interface AreaResumen {
  id: string;
  nombre: string;
  personas: number;
}

export interface PersonaResumen {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  cargo: string | null;
  areaId: string | null;
  areaNombre: string | null;
  roles: Rol[];
  estado: EstadoUsuario;
  /** Null si ya activó su cuenta o si la invitación fue revocada. */
  invitacionExpiraAt: string | null;
}

export const crearAreaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre del área es obligatorio')
    .max(80, 'El nombre es demasiado largo'),
});
export type CrearAreaInput = z.infer<typeof crearAreaSchema>;

export const invitarPersonaSchema = z.object({
  email: emailSchema,
  roles: z
    .array(z.enum(ROLES_INVITABLES))
    .min(1, 'Elige al menos un rol')
    .refine((roles) => new Set(roles).size === roles.length, 'No repitas el mismo rol'),
  areaId: z.uuid('Área inválida').optional(),
  cargo: z.string().trim().max(80, 'El cargo es demasiado largo').optional(),
});
export type InvitarPersonaInput = z.infer<typeof invitarPersonaSchema>;

/**
 * Normaliza un nombre para comparar sin distinguir mayúsculas, tildes ni espacios de más.
 * Se usa para que "Operaciones", "operaciones" y "Operaciónes " no convivan como áreas distintas.
 */
export function normalizarNombre(valor: string): string {
  return valor.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}
