import { permisosDe, type UsuarioSesion } from '@enactiva/shared';

/**
 * A dónde llega cada persona después de entrar: el equipo de ENACTIVA al panel de empresas,
 * y quien trabaja en una empresa a su propio inicio (su panel llega en el MVP 2).
 * Se calcula con el usuario recién recibido, no con el estado de React, que aún no se actualizó.
 */
export function destinoDe(usuario: UsuarioSesion | null): string {
  if (!usuario) return '/login';

  const permisos = permisosDe(usuario.roles, usuario.nivelAdmin);
  if (permisos.has('empresas:listar')) return '/empresas';
  if (permisos.has('personas:gestionar')) return '/personas';
  return '/inicio';
}
