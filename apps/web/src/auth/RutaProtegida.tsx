import type { Permiso } from '@enactiva/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSesion } from '@/auth/sesion';

interface Props {
  /** Permiso exigido para entrar. Si no se indica, basta con tener sesión iniciada. */
  permiso?: Permiso;
  children: ReactNode;
}

export function RutaProtegida({ permiso, children }: Props) {
  const { usuario, cargando, puede } = useSesion();
  const ubicacion = useLocation();

  if (cargando) {
    return <p className="p-8 text-sm text-texto-suave">Cargando…</p>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  if (permiso && !puede(permiso)) {
    return <Navigate to="/sin-permiso" replace />;
  }

  return <>{children}</>;
}
