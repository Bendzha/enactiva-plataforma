import type { NivelAdmin, Rol } from './enums.js';

/**
 * Permisos del sistema (ADR-0003). La lista crece slice a slice.
 * La API los exige en cada endpoint; la web los usa para no mostrar acciones que no se pueden hacer.
 */
export const PERMISOS = [
  'empresas:listar',
  'empresas:crear',
  'empresas:activar',
  'invitaciones:gestionar',
  'metricas-globales:ver',
  'admins:gestionar',
] as const;
export type Permiso = (typeof PERMISOS)[number];

/** El Admin Operativo carga empresas e invita; no activa ni ve métricas (confirmado por la clienta). */
const PERMISOS_ADMIN_OPERATIVO: readonly Permiso[] = [
  'empresas:listar',
  'empresas:crear',
  'invitaciones:gestionar',
];

const PERMISOS_ADMIN_PRINCIPAL: readonly Permiso[] = [
  ...PERMISOS_ADMIN_OPERATIVO,
  'empresas:activar',
  'metricas-globales:ver',
  'admins:gestionar',
];

/** Permisos que da el rol por sí solo. Se completan cuando cada slice agregue sus endpoints. */
const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  ADMIN_ENACTIVA: [],
  RRHH: [],
  CAPACITADOR: [],
  ESTUDIANTE: [],
};

export function permisosDe(roles: readonly Rol[], nivelAdmin: NivelAdmin | null): Set<Permiso> {
  const permisos = new Set<Permiso>();

  for (const rol of roles) {
    for (const permiso of PERMISOS_POR_ROL[rol]) {
      permisos.add(permiso);
    }
  }

  if (roles.includes('ADMIN_ENACTIVA')) {
    const segunNivel =
      nivelAdmin === 'PRINCIPAL'
        ? PERMISOS_ADMIN_PRINCIPAL
        : nivelAdmin === 'OPERATIVO'
          ? PERMISOS_ADMIN_OPERATIVO
          : [];
    for (const permiso of segunNivel) {
      permisos.add(permiso);
    }
  }

  return permisos;
}

/** Exige TODOS los permisos indicados. */
export function tienePermisos(
  roles: readonly Rol[],
  nivelAdmin: NivelAdmin | null,
  requeridos: readonly Permiso[],
): boolean {
  const permisos = permisosDe(roles, nivelAdmin);
  return requeridos.every((permiso) => permisos.has(permiso));
}
