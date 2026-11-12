import { VERSIONES_LEGALES, type EstadoAceptaciones } from '@enactiva/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { ESTUDIANTE_PLANTA, renderizar, simularSesionIniciada } from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const AL_DIA: EstadoAceptaciones = {
  aceptadas: [
    {
      documento: 'AVISO_PRIVACIDAD',
      version: VERSIONES_LEGALES.AVISO_PRIVACIDAD,
      aceptadoAt: new Date('2026-11-01T12:00:00Z').toISOString(),
    },
    {
      documento: 'TERMINOS',
      version: VERSIONES_LEGALES.TERMINOS,
      aceptadoAt: new Date('2026-11-01T12:00:00Z').toISOString(),
    },
  ],
  pendientes: [],
};

const CON_EL_AVISO_VIEJO: EstadoAceptaciones = {
  aceptadas: [
    {
      documento: 'TERMINOS',
      version: VERSIONES_LEGALES.TERMINOS,
      aceptadoAt: new Date('2026-11-01T12:00:00Z').toISOString(),
    },
  ],
  pendientes: ['AVISO_PRIVACIDAD'],
};

const rutas = (aceptaciones: EstadoAceptaciones) => ({
  'GET /identity/mis-aceptaciones': { status: 200, cuerpo: aceptaciones },
  'POST /identity/mis-aceptaciones': { status: 201, cuerpo: AL_DIA },
  'GET /identity/mi-perfil': {
    status: 200,
    cuerpo: {
      usuarioId: ESTUDIANTE_PLANTA.id,
      nombre: 'Ana',
      apellido: 'Vera',
      cargo: null,
      areaNombre: null,
      interesesGenerales: '',
      puedoEnsenar: [],
      quieroAprender: [],
    },
  },
  'GET /identity/temas': { status: 200, cuerpo: [] },
  'GET /identity/solicitudes/mias': { status: 200, cuerpo: [] },
  'GET /identity/mi-empresa/personalizacion': {
    status: 200,
    cuerpo: { colores: null, logo: null, empresaNombre: 'Planta Norte' },
  },
  [`GET /learning/personas/${ESTUDIANTE_PLANTA.id}/reconocimiento`]: {
    status: 200,
    cuerpo: { valoraciones: 0, promedio: null, porDimension: [], tokens: 0, talleresDictados: 0 },
  },
  [`GET /learning/personas/${ESTUDIANTE_PLANTA.id}/referencias`]: { status: 200, cuerpo: [] },
});

/**
 * La re-aceptación (SPEC §3.7, Q21). Antes el aviso se aceptaba una sola vez al activar la
 * cuenta: si el texto cambiaba, nadie lo volvía a ver.
 */
describe('Puerta legal', () => {
  it('con todo aceptado no se interpone', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas(AL_DIA));
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aceptar y continuar/i })).not.toBeInTheDocument();
  });

  it('si cambió un documento, tapa la aplicación hasta aceptarlo', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas(CON_EL_AVISO_VIEJO));
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByText(/cambió el aviso de privacidad/i)).toBeInTheDocument();
    // La aplicación de abajo no se dibuja: un banner que se puede cerrar no es una aceptación.
    expect(screen.queryByRole('heading', { name: 'Mi perfil' })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).not.toBeInTheDocument();
  });

  it('solo pide el que cambió, no los dos', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas(CON_EL_AVISO_VIEJO));
    renderizar(<App />, { ruta: '/mi-perfil' });

    await screen.findByText(/cambió el aviso de privacidad/i);
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  it('no deja continuar sin marcar la casilla', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas(CON_EL_AVISO_VIEJO));
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByRole('button', { name: 'Aceptar y continuar' })).toBeDisabled();
  });

  it('al aceptar, la aplicación aparece', async () => {
    // El GET cambia de respuesta después del POST, como haría el servidor: si siguiera
    // devolviendo el estado viejo, la puerta volvería a cerrarse en la siguiente lectura.
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, {
      ...rutas(CON_EL_AVISO_VIEJO),
      'GET /identity/mis-aceptaciones': () => ({
        status: 200,
        cuerpo: api.veces('POST /identity/mis-aceptaciones') > 0 ? AL_DIA : CON_EL_AVISO_VIEJO,
      }),
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/mi-perfil' });

    await usuario.click(await screen.findByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Aceptar y continuar' }));

    await waitFor(() => {
      expect(api.veces('POST /identity/mis-aceptaciones')).toBe(1);
    });
    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
  });

  it('quien no quiere aceptar puede salir: no queda encerrado', async () => {
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, rutas(CON_EL_AVISO_VIEJO));
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/mi-perfil' });

    await usuario.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(api.veces('POST /auth/logout')).toBe(1));
  });
});

describe('Lo que aceptaste', () => {
  it('se pueden volver a leer los dos, con su versión y su fecha', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas(AL_DIA));
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByRole('heading', { name: 'Lo que aceptaste' })).toBeInTheDocument();
    expect(screen.getAllByText(/aceptada el 01 de noviembre de 2026/i)).toHaveLength(2);

    await usuario.click(screen.getAllByRole('button', { name: 'Leer' })[0]!);
    expect(screen.getByText(/qué datos se tratan/i)).toBeInTheDocument();
  });
});
