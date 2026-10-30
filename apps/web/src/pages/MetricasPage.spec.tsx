import type { EmpresaResumen, MetricasGlobales } from '@enactiva/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { ADMIN_PRINCIPAL, renderizar, simularSesionIniciada } from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const EMPRESAS: EmpresaResumen[] = [
  {
    id: 'e-1',
    nombre: 'Planta Norte',
    rubro: 'Minería',
    estado: 'ACTIVA',
    activadaAt: '2026-09-20T12:00:00.000Z',
    personasActivas: 12,
  },
  {
    id: 'e-2',
    nombre: 'Grupo Andesco',
    rubro: 'Retail',
    estado: 'ONBOARDING_PENDIENTE',
    activadaAt: null,
    personasActivas: 0,
  },
];

const GLOBALES: MetricasGlobales = {
  personasActivas: 12,
  personasConPerfil: 7,
  temas: 9,
  declaraciones: 23,
  empresas: [
    {
      empresaId: 'e-1',
      nombre: 'Planta Norte',
      personasActivas: 12,
      personasConPerfil: 7,
      temas: 9,
      declaraciones: 23,
      brechas: 2,
    },
  ],
};

describe('Métricas globales del piloto', () => {
  it('muestra los intereses declarados y las brechas de cada empresa', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /identity/empresas': { status: 200, cuerpo: EMPRESAS },
      'GET /identity/metricas/globales': { status: 200, cuerpo: GLOBALES },
    });
    renderizar(<App />, { ruta: '/metricas' });

    // Se espera a que llegue la tabla: los KPI ya existen antes, mostrando un guion.
    const fila = await screen.findByRole('row', { name: /Planta Norte/ });

    expect(
      within(screen.getByRole('group', { name: 'Personas con perfil' })).getByText('7'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Declaraciones' })).getByText('23'),
    ).toBeInTheDocument();

    expect(within(fila).getByText('7 de 12')).toBeInTheDocument();
    expect(within(fila).getByText('2')).toBeInTheDocument();
  });

  it('no inventa cifras de logro mientras no haya mediciones', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /identity/empresas': { status: 200, cuerpo: EMPRESAS },
      'GET /identity/metricas/globales': { status: 200, cuerpo: GLOBALES },
    });
    renderizar(<App />, { ruta: '/metricas' });

    // La tarjeta de "logro por empresa" se fue con el modelo de evaluación (ADR-0010): la
    // clienta lo sacó del alcance y dejarla reservaba espacio para algo que no va a existir.
    await screen.findByRole('heading', { name: 'Métricas globales' });
    expect(screen.queryByText(/logro por empresa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mediciones/i)).not.toBeInTheDocument();
  });
});
