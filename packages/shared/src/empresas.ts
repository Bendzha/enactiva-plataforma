import type { EstadoEmpresa, EstadoUsuario } from './enums.js';

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
