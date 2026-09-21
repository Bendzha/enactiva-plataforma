import { ETIQUETAS_ROL, type Permiso } from '@enactiva/shared';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useSesion } from '@/auth/sesion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Pestana {
  a: string;
  texto: string;
  permiso?: Permiso;
}

const PESTANAS: Pestana[] = [
  { a: '/empresas', texto: 'Empresas', permiso: 'empresas:listar' },
  { a: '/metricas', texto: 'Métricas', permiso: 'metricas-globales:ver' },
];

export function Layout() {
  const { usuario, puede, cerrarSesion } = useSesion();
  const navegar = useNavigate();

  const salir = async () => {
    await cerrarSesion();
    navegar('/login', { replace: true });
  };

  const iniciales = (usuario?.nombre ?? usuario?.email ?? '?').slice(0, 2).toUpperCase();
  const visibles = PESTANAS.filter((p) => !p.permiso || puede(p.permiso));

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-extrabold tracking-tight text-marca">
            <span className="size-2.5 rounded-full bg-acento" aria-hidden="true" />
            ENACTIVA
          </div>

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
