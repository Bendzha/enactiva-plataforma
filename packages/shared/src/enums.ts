// Vocabulario fijo del dominio, compartido entre API y web (ADR-0002).
// Debe coincidir exactamente con los enums de prisma/schema.prisma;
// identity-service tiene un test que lo verifica (src/prisma/enums.spec.ts).

export const ROLES = ['ADMIN_ENACTIVA', 'RRHH', 'CAPACITADOR', 'ESTUDIANTE'] as const;
export type Rol = (typeof ROLES)[number];

export const NIVELES_ADMIN = ['PRINCIPAL', 'OPERATIVO'] as const;
export type NivelAdmin = (typeof NIVELES_ADMIN)[number];

export const ESTADOS_EMPRESA = ['ONBOARDING_PENDIENTE', 'ACTIVA'] as const;
export type EstadoEmpresa = (typeof ESTADOS_EMPRESA)[number];

export const ESTADOS_USUARIO = ['INVITADO', 'ACTIVO', 'SUSPENDIDO', 'ANONIMIZADO'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

/**
 * Las tres dimensiones de lo que alguien puede enseñar o quiere aprender (SPEC §3.6).
 * Dejaron de ser ejes de medición el 2026-10-13 (ADR-0010); ahora sirven para emparejar.
 */
export const DIMENSIONES = ['HABILIDAD', 'CONTENIDO', 'ACTITUD'] as const;
export type Dimension = (typeof DIMENSIONES)[number];

/** Lo que una persona declara sobre un tema: que puede enseñarlo o que quiere aprenderlo (SPEC §3.6). */
export const TIPOS_INTERES = ['ENSENAR', 'APRENDER'] as const;
export type TipoInteres = (typeof TIPOS_INTERES)[number];

/**
 * Cuánto domina el tema quien va a enseñar, o desde dónde parte quien quiere aprender.
 * Alimenta el criterio "nivel" del score de afinidad (SPEC §3.6).
 * La clienta confirmó esta escala el 2026-10-13.
 */
export const NIVELES_DOMINIO = ['BASICO', 'INTERMEDIO', 'AVANZADO'] as const;
export type NivelDominio = (typeof NIVELES_DOMINIO)[number];

export const ETIQUETAS_DIMENSION: Record<Dimension, string> = {
  HABILIDAD: 'Habilidad',
  CONTENIDO: 'Contenido',
  ACTITUD: 'Actitud',
};

export const ETIQUETAS_ROL: Record<Rol, string> = {
  ADMIN_ENACTIVA: 'Admin ENACTIVA',
  RRHH: 'RRHH',
  CAPACITADOR: 'Capacitador',
  ESTUDIANTE: 'Estudiante',
};

export const ETIQUETAS_TIPO_INTERES: Record<TipoInteres, string> = {
  ENSENAR: 'Puedo enseñar',
  APRENDER: 'Quiero aprender',
};

export const ETIQUETAS_NIVEL_DOMINIO: Record<NivelDominio, string> = {
  BASICO: 'Básico',
  INTERMEDIO: 'Intermedio',
  AVANZADO: 'Avanzado',
};
