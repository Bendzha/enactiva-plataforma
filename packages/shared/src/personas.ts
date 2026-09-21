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

/** Máximo de filas por archivo importado. */
export const MAXIMO_FILAS_IMPORTACION = 500;

export const importarPersonasSchema = z.object({
  contenido: z
    .string()
    .min(1, 'El archivo está vacío')
    .max(500_000, 'El archivo es demasiado grande'),
});
export type ImportarPersonasInput = z.infer<typeof importarPersonasSchema>;

/** Una fila del CSV ya interpretada y revisada. */
export interface FilaImportada {
  /** Número de fila del archivo, contando el encabezado como 1. */
  fila: number;
  email: string;
  roles: RolInvitable[];
  area: string | null;
  /** El área no existe todavía y se creará al confirmar. */
  areaNueva: boolean;
  cargo: string | null;
  /** Null cuando la fila está lista para invitar. */
  error: string | null;
}

export interface VistaPreviaImportacion {
  filas: FilaImportada[];
  validas: number;
  conError: number;
}

export interface ResultadoImportacion extends VistaPreviaImportacion {
  invitadas: number;
  areasCreadas: string[];
}

/** Encabezados aceptados en el CSV, para no obligar a un formato exacto. */
export const COLUMNAS_IMPORTACION = {
  email: ['email', 'correo', 'e-mail'],
  roles: ['roles', 'rol'],
  area: ['area', 'área', 'departamento'],
  cargo: ['cargo', 'puesto'],
} as const;

/**
 * Normaliza un nombre para comparar sin distinguir mayúsculas, tildes ni espacios de más.
 * Se usa para que "Operaciones", "operaciones" y "Operaciónes " no convivan como áreas distintas.
 */
export function normalizarNombre(valor: string): string {
  return valor.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}
