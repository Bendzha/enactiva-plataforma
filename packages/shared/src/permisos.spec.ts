import { permisosDe, tienePermisos } from './permisos.js';

describe('permisos del equipo ENACTIVA', () => {
  it('el Admin Principal puede activar empresas, ver métricas y gestionar admins', () => {
    const permisos = permisosDe(['ADMIN_ENACTIVA'], 'PRINCIPAL');

    expect(permisos.has('empresas:activar')).toBe(true);
    expect(permisos.has('metricas-globales:ver')).toBe(true);
    expect(permisos.has('admins:gestionar')).toBe(true);
  });

  it('el Admin Operativo carga empresas e invita, pero no activa ni ve métricas', () => {
    const permisos = permisosDe(['ADMIN_ENACTIVA'], 'OPERATIVO');

    expect(permisos.has('empresas:crear')).toBe(true);
    expect(permisos.has('invitaciones:gestionar')).toBe(true);
    expect(permisos.has('empresas:activar')).toBe(false);
    expect(permisos.has('metricas-globales:ver')).toBe(false);
    expect(permisos.has('admins:gestionar')).toBe(false);
  });

  it('los roles de empresa no heredan permisos de administración', () => {
    for (const rol of ['RRHH', 'CAPACITADOR', 'ESTUDIANTE'] as const) {
      expect(permisosDe([rol], null).size).toBe(0);
    }
  });

  it('un admin sin nivel asignado no recibe permisos', () => {
    expect(permisosDe(['ADMIN_ENACTIVA'], null).size).toBe(0);
  });

  it('tienePermisos exige todos los permisos pedidos', () => {
    expect(
      tienePermisos(['ADMIN_ENACTIVA'], 'PRINCIPAL', ['empresas:crear', 'empresas:activar']),
    ).toBe(true);
    expect(
      tienePermisos(['ADMIN_ENACTIVA'], 'OPERATIVO', ['empresas:crear', 'empresas:activar']),
    ).toBe(false);
  });

  it('una persona con varios roles suma los permisos de todos', () => {
    const permisos = permisosDe(['CAPACITADOR', 'ESTUDIANTE', 'ADMIN_ENACTIVA'], 'OPERATIVO');

    expect(permisos.has('empresas:crear')).toBe(true);
  });
});
