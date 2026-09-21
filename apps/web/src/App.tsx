import { Navigate, Route, Routes } from 'react-router';
import { RutaProtegida } from '@/auth/RutaProtegida';
import { Layout } from '@/components/Layout';
import { ActivarPage } from '@/pages/ActivarPage';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { EquipoPage } from '@/pages/EquipoPage';
import { InicioPage } from '@/pages/InicioPage';
import { LoginPage } from '@/pages/LoginPage';
import { MetricasPage } from '@/pages/MetricasPage';
import { SinPermisoPage } from '@/pages/SinPermisoPage';

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
