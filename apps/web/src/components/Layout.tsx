import { Marca } from '@/components/marca/Marca';
import { ETIQUETAS_ROL, participaEnLaRed, type Permiso } from '@enactiva/shared';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { Button } from '@/components/ui/button';
import { usePersonalizacion, useAplicarPersonalizacion } from '@/lib/personalizacion';
import { cn } from '@/lib/utils';

interface Pestana {
  a: string;
  texto: string;
  permiso?: Permiso;
  /** El perfil corporativo es de quien trabaja en una empresa; el equipo ENACTIVA no tiene. */
  requiereEmpresa?: boolean;
  /**
   * Solo para quien participa de los talleres. RRHH administra y no participa (2026-11-11):
   * su entorno es el de administración y nada más.
   */
  soloParticipantes?: boolean;
  /** Lo contrario: solo para quien administra y no participa. */
  soloAdministradores?: boolean;
}

const PESTANAS: Pestana[] = [
  { a: '/descubrir', texto: 'Descubrir', requiereEmpresa: true, soloParticipantes: true },
  { a: '/mi-perfil', texto: 'Mi perfil', requiereEmpresa: true, soloParticipantes: true },
  { a: '/agenda', texto: 'Mi agenda', requiereEmpresa: true, soloParticipantes: true },
  { a: '/talleres', texto: 'Talleres', requiereEmpresa: true, soloParticipantes: true },
  { a: '/personas', texto: 'Personas', permiso: 'personas:gestionar' },
  { a: '/solicitudes', texto: 'Solicitudes', permiso: 'solicitudes:resolver' },
  { a: '/temas', texto: 'Temas', permiso: 'temas:crear' },
  { a: '/personalizacion', texto: 'Entorno', permiso: 'empresa:personalizar' },
  { a: '/empresas', texto: 'Empresas', permiso: 'empresas:listar' },
  { a: '/metricas', texto: 'Métricas', permiso: 'metricas-globales:ver' },
  { a: '/equipo', texto: 'Equipo', permiso: 'admins:gestionar' },
  // Va al final porque es la cuenta de quien mira, no una sección del trabajo. Quien participa
  // llega a lo mismo —y a su perfil— desde «Mi perfil».
  { a: '/mi-cuenta', texto: 'Mi cuenta', soloAdministradores: true },
];

export function Layout() {
  const { usuario, puede, cerrarSesion } = useSesion();
  const navegar = useNavigate();

  // Solo dentro de una empresa: el equipo de ENACTIVA no personaliza nada (ADR-0011).
  const { data: personalizacion } = usePersonalizacion(usuario?.empresaId);
  useAplicarPersonalizacion(personalizacion?.colores);

  const salir = async () => {
    await cerrarSesion();
    navegar('/login', { replace: true });
  };

  const iniciales = (usuario?.nombre ?? usuario?.email ?? '?').slice(0, 2).toUpperCase();
  const participa = usuario ? participaEnLaRed(usuario.roles) : false;
  const visibles = PESTANAS.filter(
    (p) =>
      (!p.permiso || puede(p.permiso)) &&
      (!p.requiereEmpresa || Boolean(usuario?.empresaId)) &&
      (!p.soloParticipantes || participa) &&
      (!p.soloAdministradores || !participa),
  );

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          {personalizacion?.logo ? (
            <img
              src={personalizacion.logo}
              alt={personalizacion.empresaNombre}
              className="max-h-9 max-w-40 object-contain"
            />
          ) : (
            <Marca />
          )}

          <nav className="flex gap-1" aria-label="Secciones">
            {visibles.map((pestana) => (
              <NavLink
                key={pestana.a}
                to={pestana.a}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-marca-suave text-marca' : 'text-texto-suave hover:text-marca',
                  )
                }
              >
                {pestana.texto}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold">{usuario?.nombre ?? usuario?.email}</div>
              <div className="text-xs text-texto-suave">
                {usuario?.roles.map((rol) => ETIQUETAS_ROL[rol]).join(' · ')}
              </div>
            </div>
            <div className="grid size-9 place-items-center rounded-full bg-marca text-xs font-bold text-white">
              {iniciales}
            </div>
            <Button variant="outline" size="sm" onClick={salir}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
