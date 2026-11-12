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
  /** RRHH: áreas y personas de su propia empresa. */
  'personas:gestionar',
  /**
   * Agregar temas al catálogo de la empresa. **Solo RRHH** desde la reunión del 2026-10-29:
   * la clienta pidió que el catálogo lo controle Recursos Humanos, no quien enseña.
   */
  'temas:crear',
  /** Publicar la ficha de un taller y declarar cuándo se puede enseñar (SPEC §3.2). */
  'talleres:publicar',
  /**
   * Ocultar una referencia escrita sobre un colega, dejando registro (SPEC §3.5, Q17).
   * Solo RRHH: es una decisión laboral dentro de la empresa, no de quien opera la plataforma.
   */
  'referencias:moderar',
  /**
   * Resolver las solicitudes de su empresa: proponer un taller y pasar a quien enseña
   * (SPEC §2, reunión del 2026-10-29). Solo RRHH: es quien controla el catálogo y los roles.
   */
  'solicitudes:resolver',
  /**
   * Poner el logo y los colores de su empresa (SPEC §3.8, ADR-0011). Solo RRHH: es la identidad
   * visual de esa organización, y el equipo de ENACTIVA administra el piloto, no su marca.
   */
  'empresa:personalizar',
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
  // Gestionar la gente de su empresa es de RRHH; el equipo de ENACTIVA administra el piloto,
  // no el día a día de cada organización.
  RRHH: [
    'personas:gestionar',
    'temas:crear',
    'referencias:moderar',
    'solicitudes:resolver',
    'empresa:personalizar',
  ],
  // Ya no crea temas: el catálogo es de RRHH (2026-10-29). Quien quiera enseñar algo que no
  // está en la lista se lo pide a RRHH; la pantalla se lo dice.
  CAPACITADOR: ['talleres:publicar'],
  ESTUDIANTE: [],
};

/**
 * Quién participa de la capacitación entre pares, y quién solo la administra
 * **[C, 2026-11-11]**: *«que el perfil de RRHH esté separado del perfil de quien enseña y quien
 * aprende […] que solo sea un administrador»*.
 *
 * RRHH gestiona a su gente, el catálogo y las solicitudes; no declara lo que sabe, no hace swipe
 * ni se inscribe. El equipo de ENACTIVA tampoco, que además no pertenece a ninguna empresa.
 *
 * Esto no es una preferencia de pantalla: quien administra decide sobre la participación de
 * otros, y participar al mismo tiempo mezcla las dos cosas. Por eso los servicios también lo
 * exigen, con `@SoloQuienParticipa()`.
 */
export function participaEnLaRed(roles: readonly Rol[]): boolean {
  return !roles.includes('RRHH') && !roles.includes('ADMIN_ENACTIVA');
}

/** El rol RRHH es excluyente: no convive con enseñar ni con aprender. */
export function rolesCompatibles(roles: readonly Rol[]): boolean {
  return roles.includes('RRHH') ? roles.length === 1 : true;
}

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
