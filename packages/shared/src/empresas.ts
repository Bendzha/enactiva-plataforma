import { z } from 'zod';
import { emailSchema } from './auth.js';
import type { EstadoEmpresa, EstadoUsuario } from './enums.js';

export const crearEmpresaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre de la empresa es obligatorio')
    .max(120, 'El nombre es demasiado largo'),
  rubro: z.string().trim().min(2, 'El rubro es obligatorio').max(80, 'El rubro es demasiado largo'),
  /** Email de la persona de RRHH que recibirá la invitación. */
  emailRrhh: emailSchema,
});
export type CrearEmpresaInput = z.infer<typeof crearEmpresaSchema>;

/** Empresa tal como se muestra en el listado del panel de ENACTIVA. */
export interface EmpresaResumen {
  id: string;
  nombre: string;
  rubro: string;
  estado: EstadoEmpresa;
  /** Fecha en que un Admin Principal la activó; null mientras está en onboarding. */
  activadaAt: string | null;
  personasActivas: number;
}

/** Contacto de RRHH creado junto con la empresa. */
export interface ContactoRrhh {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  estado: EstadoUsuario;
  /** Null si ya activó su cuenta o si la invitación fue revocada. */
  invitacionExpiraAt: string | null;
}

export interface EmpresaDetalle extends EmpresaResumen {
  contactoRrhh: ContactoRrhh | null;
  createdAt: string;
}
