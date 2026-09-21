import { Navigate, Route, Routes } from 'react-router';
import { RutaProtegida } from '@/auth/RutaProtegida';
import { Layout } from '@/components/Layout';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { LoginPage } from '@/pages/LoginPage';
import { MetricasPage } from '@/pages/MetricasPage';
import { SinPermisoPage } from '@/pages/SinPermisoPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RutaProtegida>
            <Layout />
          </RutaProtegida>
        }
      >
        <Route index element={<Navigate to="/empresas" replace />} />
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
        <Route path="/sin-permiso" element={<SinPermisoPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
