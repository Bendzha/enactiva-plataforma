import { SetMetadata } from '@nestjs/common';
import type { Permiso } from '@enactiva/shared';

export const CLAVE_PUBLICO = 'ruta:publica';
export const CLAVE_SOLO_SESION = 'ruta:solo-sesion';
export const CLAVE_PERMISOS = 'ruta:permisos';
export const CLAVE_INTERNO = 'ruta:interna';
export const CLAVE_SOLO_PARTICIPA = 'ruta:solo-participa';

/** Accesible sin iniciar sesión (login, health). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Requiere sesión iniciada, sin exigir un permiso concreto (ej. ver el propio perfil). */
export const SoloSesion = () => SetMetadata(CLAVE_SOLO_SESION, true);

/** Requiere sesión y TODOS los permisos indicados. */
export const RequierePermiso = (...permisos: Permiso[]) => SetMetadata(CLAVE_PERMISOS, permisos);

/**
 * Requiere sesión **y participar** de la capacitación entre pares (2026-11-11).
 *
 * Deja fuera a RRHH y al equipo de ENACTIVA, que administran y no participan: declarar lo que
 * uno sabe, hacer swipe, inscribirse y valorar son de quien enseña y de quien aprende.
 *
 * Es un decorador aparte y no un permiso porque no se concede: es la otra cara del rol. Un
 * permiso `red:participar` habría que acordarse de quitárselo a RRHH; esto no se puede olvidar.
 */
export const SoloQuienParticipa = () => SetMetadata(CLAVE_SOLO_PARTICIPA, true);

/**
 * Ruta que solo puede llamar otro servicio, con el secreto compartido en la cabecera
 * `x-interno-secreto` (ADR-0007).
 *
 * Es para las rutas anteriores al login, donde todavía no existe un token de usuario que
 * reenviar: verificar credenciales, rotar el refresh y aceptar una invitación. Sin esto,
 * cualquiera que alcance el servicio por la red podría probar contraseñas contra él.
 * El gateway nunca expone estas rutas hacia afuera.
 */
export const SoloInterno = () => SetMetadata(CLAVE_INTERNO, true);
