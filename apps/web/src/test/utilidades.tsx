import type { UsuarioSesion } from '@enactiva/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { SesionProvider } from '@/auth/sesion';
import { guardarToken } from '@/lib/api';

export const ADMIN_PRINCIPAL: UsuarioSesion = {
  id: 'u-principal',
  email: 'principal@plataforma.local',
  nombre: 'Karina',
  apellido: 'López',
  roles: ['ADMIN_ENACTIVA'],
  nivelAdmin: 'PRINCIPAL',
  empresaId: null,
};

export const ADMIN_OPERATIVO: UsuarioSesion = {
  ...ADMIN_PRINCIPAL,
  id: 'u-operativo',
  email: 'operativo@plataforma.local',
  nombre: 'Equipo',
  nivelAdmin: 'OPERATIVO',
};

interface RespuestaFalsa {
  status: number;
  cuerpo?: unknown;
}

type Manejador = RespuestaFalsa | (() => RespuestaFalsa);

/**
 * Reemplaza fetch por un mapa de ruta -> respuesta, para no depender de la API real.
 * Las claves pueden ser "/ruta" o "MÉTODO /ruta" (por ejemplo "POST /empresas").
 */
export function simularApi(rutas: Record<string, Manejador>) {
  const llamadas: string[] = [];

  const fetchFalso = vi.fn(async (url: string | URL | Request, opciones?: RequestInit) => {
    const ruta = new URL(String(url)).pathname;
    const metodo = (opciones?.method ?? 'GET').toUpperCase();
    llamadas.push(`${metodo} ${ruta}`);

    const manejador = rutas[`${metodo} ${ruta}`] ?? rutas[ruta] ?? { status: 404 };
    const respuesta = typeof manejador === 'function' ? manejador() : manejador;

    return new Response(respuesta.cuerpo === undefined ? null : JSON.stringify(respuesta.cuerpo), {
      status: respuesta.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchFalso);
  return {
    llamadas,
    fetchFalso,
    /** Cuántas veces se llamó a "MÉTODO /ruta". */
    veces: (clave: string) => llamadas.filter((l) => l === clave).length,
  };
}

/** Sesión ya iniciada: la API responde al refresh con este usuario. */
export function simularSesionIniciada(
  usuario: UsuarioSesion,
  rutas: Record<string, Manejador> = {},
) {
  return simularApi({
    '/auth/refresh': { status: 200, cuerpo: { accessToken: 'token-de-prueba', usuario } },
    '/auth/logout': { status: 204 },
    ...rutas,
  });
}

export function renderizar(ui: ReactNode, { ruta = '/' }: { ruta?: string } = {}) {
  guardarToken(null);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <SesionProvider>{ui}</SesionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
