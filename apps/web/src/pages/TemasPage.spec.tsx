import type { TemaResumen } from '@enactiva/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ESTUDIANTE_PLANTA,
  RRHH_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const EXCEL: TemaResumen = {
  id: '11111111-1111-7111-8111-111111111111',
  nombre: 'Excel avanzado',
  puedenEnsenar: 2,
  quierenAprender: 3,
};

const rutas = (temas: TemaResumen[] = [EXCEL]) => ({
  'GET /identity/temas': { status: 200, cuerpo: temas },
  'POST /identity/temas': {
    status: 201,
    cuerpo: {
      id: '55555555-5555-7555-8555-555555555555',
      nombre: 'Hablar en público',
      puedenEnsenar: 0,
      quierenAprender: 0,
    },
  },
  'GET /identity/mi-empresa/personalizacion': {
    status: 200,
    cuerpo: { colores: null, logo: null, empresaNombre: 'Planta Norte' },
  },
});

/**
 * El catálogo de temas (SPEC §3.6).
 *
 * Esta pantalla existe desde el 2026-11-11. Antes el único lugar donde se podía crear un tema era
 * el diálogo de «Mi perfil», que es para declarar lo de uno: RRHH tenía que entrar a su propio
 * perfil y declarar que enseñaba algo para poder agregarlo.
 */
describe('Catálogo de temas', () => {
  it('muestra los temas con cuánta gente los ofrece y los busca', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas());
    renderizar(<App />, { ruta: '/temas' });

    expect(await screen.findByText('Excel avanzado')).toBeInTheDocument();
    expect(screen.getByText(/2 pueden enseñarlo · 3 quieren aprenderlo/)).toBeInTheDocument();
  });

  it('RRHH suma al catálogo los temas que no existen', async () => {
    const api = simularSesionIniciada(RRHH_PLANTA, rutas([]));
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/temas' });

    await usuario.type(await screen.findByLabelText('Nombre del tema'), 'Hablar en público');
    await usuario.click(screen.getByRole('button', { name: 'Agregar al catálogo' }));

    await waitFor(() => {
      expect(api.veces('POST /identity/temas')).toBe(1);
    });
    expect(await screen.findByText(/quedó en el catálogo/i)).toBeInTheDocument();
  });

  it('no deja crear uno que ya está: romperían el emparejamiento', async () => {
    const api = simularSesionIniciada(RRHH_PLANTA, rutas());
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/temas' });

    // El normalizado es el que decide: «EXCEL  Avanzado» y «Excel avanzado» son el mismo.
    await usuario.type(await screen.findByLabelText('Nombre del tema'), 'EXCEL  Avanzado');

    expect(screen.getByRole('button', { name: 'Agregar al catálogo' })).toBeDisabled();
    expect(api.veces('POST /identity/temas')).toBe(0);
  });

  it('quitar un tema avisa que no se borra nada', async () => {
    const api = simularSesionIniciada(RRHH_PLANTA, {
      ...rutas(),
      [`DELETE /identity/temas/${EXCEL.id}`]: { status: 204 },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/temas' });

    await usuario.click(await screen.findByRole('button', { name: 'Quitar' }));

    // Un botón «Quitar» hace pensar en borrar, y acá no se borra nada: de un tema cuelgan los
    // perfiles de la gente y los talleres ya convocados.
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent(/no se borra nada/i);
    expect(dialogo).toHaveTextContent(/5 declaraciones/);

    await usuario.click(within(dialogo).getByRole('button', { name: 'Quitar del catálogo' }));

    await waitFor(() => {
      expect(api.veces(`DELETE /identity/temas/${EXCEL.id}`)).toBe(1);
    });
    expect(await screen.findByText(/salió del catálogo/i)).toBeInTheDocument();
  });

  it('quien no administra el catálogo no entra', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas());
    renderizar(<App />, { ruta: '/temas' });

    expect(await screen.findByText(/no tienes acceso a esta sección/i)).toBeInTheDocument();
  });
});
