import { SetMetadata } from '@nestjs/common';
import type { Permiso } from '@enactiva/shared';

export const CLAVE_PUBLICO = 'ruta:publica';
export const CLAVE_SOLO_SESION = 'ruta:solo-sesion';
export const CLAVE_PERMISOS = 'ruta:permisos';

/** Accesible sin iniciar sesión (login, health). */
export const Publico = () => SetMetadata(CLAVE_PUBLICO, true);

/** Requiere sesión iniciada, sin exigir un permiso concreto (ej. ver el propio perfil). */
export const SoloSesion = () => SetMetadata(CLAVE_SOLO_SESION, true);

/** Requiere sesión y TODOS los permisos indicados. */
export const RequierePermiso = (...permisos: Permiso[]) => SetMetadata(CLAVE_PERMISOS, permisos);
