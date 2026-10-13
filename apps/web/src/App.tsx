import { Navigate, Route, Routes } from 'react-router';
import { RutaProtegida } from '@/auth/RutaProtegida';
import { Layout } from '@/components/Layout';
import { ActivarPage } from '@/pages/ActivarPage';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { EquipoPage } from '@/pages/EquipoPage';
import { InicioPage } from '@/pages/InicioPage';
import { LoginPage } from '@/pages/LoginPage';
import { MetricasPage } from '@/pages/MetricasPage';
import { MiPerfilPage } from '@/pages/MiPerfilPage';
import { PersonasPage } from '@/pages/PersonasPage';
import { SinPermisoPage } from '@/pages/SinPermisoPage';
import { TalleresPage } from '@/pages/TalleresPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Pública: se llega desde el enlace del correo, sin cuenta activa todavía. */}
      <Route path="/activar" element={<ActivarPage />} />

      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route index element={<Navigate to="/inicio" replace />} />
        <Route path="/inicio" element={<InicioPage />} />
        {/* Sin permiso: cualquiera con sesión gestiona su propio perfil. */}
        <Route path="/mi-perfil" element={<MiPerfilPage />} />
        {/* Sin permiso: cualquiera de una empresa mira los talleres y se inscribe. */}
        <Route path="/talleres" element={<TalleresPage />} />
        <Route
          path="/empresas"
          element={
            <RutaProtegida permiso="empresas:listar">
              <EmpresasPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/metricas"
          element={
            <RutaProtegida permiso="metricas-globales:ver">
              <MetricasPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/personas"
          element={
            <RutaProtegida permiso="personas:gestionar">
              <PersonasPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/equipo"
          element={
            <RutaProtegida permiso="admins:gestionar">
              <EquipoPage />
            </RutaProtegida>
          }
        />
        <Route path="/sin-permiso" element={<SinPermisoPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
