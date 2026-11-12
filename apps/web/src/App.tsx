import { Navigate, Route, Routes } from 'react-router';
import { RutaProtegida } from '@/auth/RutaProtegida';
import { Layout } from '@/components/Layout';
import { PuertaLegal } from '@/components/legales/PuertaLegal';
import { ActivarPage } from '@/pages/ActivarPage';
import { AgendaPage } from '@/pages/AgendaPage';
import { DescubrirPage } from '@/pages/DescubrirPage';
import { EmpresasPage } from '@/pages/EmpresasPage';
import { EquipoPage } from '@/pages/EquipoPage';
import { InicioPage } from '@/pages/InicioPage';
import { LoginPage } from '@/pages/LoginPage';
import { RecuperarPage } from '@/pages/RecuperarPage';
import { RestablecerPage } from '@/pages/RestablecerPage';
import { MetricasPage } from '@/pages/MetricasPage';
import { MiCuentaPage } from '@/pages/MiCuentaPage';
import { MiPerfilPage } from '@/pages/MiPerfilPage';
import { PersonasPage } from '@/pages/PersonasPage';
import { SolicitudesPage } from '@/pages/SolicitudesPage';
import { PersonalizacionPage } from '@/pages/PersonalizacionPage';
import { TemasPage } from '@/pages/TemasPage';
import { SinPermisoPage } from '@/pages/SinPermisoPage';
import { TalleresPage } from '@/pages/TalleresPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Pública: se llega desde el enlace del correo, sin cuenta activa todavía. */}
      <Route path="/activar" element={<ActivarPage />} />
      <Route path="/recuperar" element={<RecuperarPage />} />
      <Route path="/restablecer" element={<RestablecerPage />} />

      <Route
        element={
          <RutaProtegida>
            {/* Antes que cualquier pantalla: si cambió un documento legal, se acepta o se sale. */}
            <PuertaLegal>
              <Layout />
            </PuertaLegal>
          </RutaProtegida>
        }
      >
        <Route index element={<Navigate to="/inicio" replace />} />
        <Route path="/inicio" element={<InicioPage />} />
        {/* La cuenta de quien administra: sus datos y nada de enseñar ni aprender. */}
        <Route path="/mi-cuenta" element={<MiCuentaPage />} />
        {/* Las cuatro de participar. RRHH administra y no participa (2026-11-11). */}
        <Route
          path="/mi-perfil"
          element={
            <RutaProtegida soloParticipantes>
              <MiPerfilPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/talleres"
          element={
            <RutaProtegida soloParticipantes>
              <TalleresPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/descubrir"
          element={
            <RutaProtegida soloParticipantes>
              <DescubrirPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/agenda"
          element={
            <RutaProtegida soloParticipantes>
              <AgendaPage />
            </RutaProtegida>
          }
        />
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
          path="/solicitudes"
          element={
            <RutaProtegida permiso="solicitudes:resolver">
              <SolicitudesPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/temas"
          element={
            <RutaProtegida permiso="temas:crear">
              <TemasPage />
            </RutaProtegida>
          }
        />
        <Route
          path="/personalizacion"
          element={
            <RutaProtegida permiso="empresa:personalizar">
              <PersonalizacionPage />
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
