import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ADMIN_OPERATIVO,
  ADMIN_PRINCIPAL,
  renderizar,
  simularApi,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Rutas protegidas', () => {
  it('sin sesión, una ruta protegida manda al login', async () => {
    simularApi({ '/auth/refresh': { status: 401 } });
    renderizar(<App />, { ruta: '/empresas' });

    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('el Admin Principal ve la pestaña Métricas y puede entrar', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL);
    renderizar(<App />, { ruta: '/metricas' });

    expect(await screen.findByRole('heading', { name: 'Métricas globales' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Métricas' })).toBeInTheDocument();
  });

  it('el Admin Operativo no ve la pestaña Métricas', async () => {
    simularSesionIniciada(ADMIN_OPERATIVO);
    renderizar(<App />, { ruta: '/empresas' });

    expect(await screen.findByRole('heading', { name: 'Empresas piloto' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Empresas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Métricas' })).not.toBeInTheDocument();
  });

  it('si el Admin Operativo entra a Métricas por la URL, se le redirige a "sin permiso"', async () => {
    simularSesionIniciada(ADMIN_OPERATIVO);
    renderizar(<App />, { ruta: '/metricas' });

    expect(
      await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Métricas globales' })).not.toBeInTheDocument();
  });
});
