// Vocabulario fijo del dominio, compartido entre API y web (ADR-0002).
// Debe coincidir exactamente con los enums de prisma/schema.prisma;
// apps/api tiene un test que lo verifica.

export const ROLES = ['ADMIN_ENACTIVA', 'RRHH', 'CAPACITADOR', 'ESTUDIANTE'] as const;
export type Rol = (typeof ROLES)[number];

export const NIVELES_ADMIN = ['PRINCIPAL', 'OPERATIVO'] as const;
export type NivelAdmin = (typeof NIVELES_ADMIN)[number];

export const ESTADOS_EMPRESA = ['ONBOARDING_PENDIENTE', 'ACTIVA'] as const;
export type EstadoEmpresa = (typeof ESTADOS_EMPRESA)[number];

export const ESTADOS_USUARIO = ['INVITADO', 'ACTIVO', 'SUSPENDIDO', 'ANONIMIZADO'] as const;
export type EstadoUsuario = (typeof ESTADOS_USUARIO)[number];

/** Las tres dimensiones que se miden, tanto a quien enseña como a quien aprende (SPEC §3.3). */
export const DIMENSIONES = ['HABILIDAD', 'CONTENIDO', 'ACTITUD'] as const;
export type Dimension = (typeof DIMENSIONES)[number];

/** Los tres momentos de medición; el valor está en la comparación entre ellos (SPEC §3.3). */
export const MOMENTOS = ['DIAGNOSTICO', 'INTERMEDIO', 'MONITOREO'] as const;
export type Momento = (typeof MOMENTOS)[number];

/** Estructura estandarizada de todo curso, sin excepciones (SPEC §3.2). */
export const ETAPAS_CURSO = ['DIAGNOSTICO', 'CLASE', 'MONITOREO'] as const;
export type EtapaCurso = (typeof ETAPAS_CURSO)[number];

export const ETIQUETAS_DIMENSION: Record<Dimension, string> = {
  HABILIDAD: 'Habilidad',
  CONTENIDO: 'Contenido',
  ACTITUD: 'Actitud',
};

export const ETIQUETAS_MOMENTO: Record<Momento, string> = {
  DIAGNOSTICO: 'Diagnóstico',
  INTERMEDIO: 'Intermedio',
  MONITOREO: 'Monitoreo',
};

export const ETIQUETAS_ROL: Record<Rol, string> = {
  ADMIN_ENACTIVA: 'Admin ENACTIVA',
  RRHH: 'RRHH',
  CAPACITADOR: 'Capacitador',
  ESTUDIANTE: 'Estudiante',
};
