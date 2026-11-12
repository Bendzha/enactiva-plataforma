import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ADMIN_PRINCIPAL,
  ESTUDIANTE_PLANTA,
  RRHH_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const PERFIL_VACIO = {
  nombre: 'Ana',
  apellido: 'Vera',
  cargo: null,
  area: null,
  interesesGenerales: '',
  puedoEnsenar: [],
  quieroAprender: [],
};

const rutas = {
  'GET /identity/mi-empresa/personalizacion': {
    status: 200,
    cuerpo: { colores: null, logo: null, empresaNombre: 'Planta Norte' },
  },
  'GET /identity/personas': { status: 200, cuerpo: [] },
  'GET /identity/areas': { status: 200, cuerpo: [] },
  'GET /identity/metricas/intereses': { status: 200, cuerpo: null },
  'GET /identity/mi-perfil': { status: 200, cuerpo: PERFIL_VACIO },
  'GET /identity/solicitudes/mias': { status: 200, cuerpo: [] },
  'GET /learning/agenda': { status: 200, cuerpo: { proximos: [], pasados: [] } },
  'GET /learning/reconocimiento/u-estudiante': {
    status: 200,
    cuerpo: { valoraciones: 0, promedio: null, porDimension: [], tokens: 0, referencias: [] },
  },
};

/**
 * RRHH administra y no participa (2026-11-11). En la web eso significa que no tiene las cuatro
 * pantallas de participar, y que tiene una propia para su cuenta.
 */
describe('RRHH solo ve su entorno de administración', () => {
  it('no le aparecen las pestañas de participar', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas);
    renderizar(<App />, { ruta: '/personas' });

    await screen.findByRole('heading', { name: 'Personas' });
    const menu = screen.getByRole('navigation', { name: 'Secciones' });

    for (const pestana of ['Descubrir', 'Mi perfil', 'Mi agenda', 'Talleres']) {
      expect(screen.queryByRole('link', { name: pestana }), pestana).not.toBeInTheDocument();
    }
    // Las suyas sí: gestionar a su gente, el catálogo, lo que le piden y su entorno.
    for (const pestana of ['Personas', 'Solicitudes', 'Temas', 'Entorno', 'Mi cuenta']) {
      expect(within(menu).getByRole('link', { name: pestana }), pestana).toBeInTheDocument();
    }
  });

  it('escribir la dirección a mano tampoco la deja entrar', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas);
    renderizar(<App />, { ruta: '/descubrir' });

    expect(await screen.findByText(/no tienes acceso a esta sección/i)).toBeInTheDocument();
  });

  it('su inicio la manda a administrar, no a completar un perfil que no tiene', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas);
    renderizar(<App />, { ruta: '/inicio' });

    expect(await screen.findByRole('heading', { name: /por dónde empezar/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /completar mi perfil/i })).not.toBeInTheDocument();
  });

  it('en «Mi cuenta» puede descargar sus datos pero no borrarse', async () => {
    // Si la única RRHH se elimina, su organización se queda sin quien la administre.
    simularSesionIniciada(RRHH_PLANTA, rutas);
    renderizar(<App />, { ruta: '/mi-cuenta' });

    expect(await screen.findByRole('button', { name: /descargar mis datos/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar mi cuenta/i })).not.toBeInTheDocument();
  });
});

describe('Quien participa no pierde nada', () => {
  it('sigue viendo sus cuatro pantallas y no la de administrar', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas);
    renderizar(<App />, { ruta: '/mi-perfil' });

    const menu = await screen.findByRole('navigation', { name: 'Secciones' });
    for (const pestana of ['Descubrir', 'Mi perfil', 'Mi agenda', 'Talleres']) {
      expect(within(menu).getByRole('link', { name: pestana }), pestana).toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: 'Mi cuenta' })).not.toBeInTheDocument();
  });
});

describe('El equipo de ENACTIVA tampoco participa', () => {
  it('ve «Mi cuenta» y no las pantallas de participar', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      ...rutas,
      'GET /identity/empresas': { status: 200, cuerpo: [] },
    });
    renderizar(<App />, { ruta: '/empresas' });

    const menu = await screen.findByRole('navigation', { name: 'Secciones' });
    expect(within(menu).getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Descubrir' })).not.toBeInTheDocument();
  });
});
