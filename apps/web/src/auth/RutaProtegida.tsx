import { participaEnLaRed, type Permiso } from '@enactiva/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSesion } from '@/auth/sesion';

interface Props {
  /** Permiso exigido para entrar. Si no se indica, basta con tener sesión iniciada. */
  permiso?: Permiso;
  /**
   * Exige **participar** de los talleres: deja fuera a RRHH y al equipo de ENACTIVA
   * (2026-11-11). Es lo mismo que exige `@SoloQuienParticipa()` en los servicios; acá solo
   * evita que la pantalla se dibuje para después quedarse vacía con un 403.
   */
  soloParticipantes?: boolean;
  children: ReactNode;
}

export function RutaProtegida({ permiso, soloParticipantes, children }: Props) {
  const { usuario, cargando, puede } = useSesion();
  const ubicacion = useLocation();

  if (cargando) {
    return <p className="p-8 text-sm text-texto-suave">Cargando…</p>;
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }

  if (soloParticipantes && !participaEnLaRed(usuario.roles)) {
    return <Navigate to="/sin-permiso" replace />;
  }

  if (permiso && !puede(permiso)) {
    return <Navigate to="/sin-permiso" replace />;
  }

  return <>{children}</>;
}
