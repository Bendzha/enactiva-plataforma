import { CONFIRMACION_SUPRESION, type MiPerfil } from '@enactiva/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ADMIN_PRINCIPAL,
  ESTUDIANTE_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PERFIL: MiPerfil = {
  usuarioId: ESTUDIANTE_PLANTA.id,
  nombre: 'Ana',
  apellido: 'Vera',
  cargo: 'Operadora',
  areaNombre: 'Operaciones',
  interesesGenerales: '',
  puedoEnsenar: [],
  quieroAprender: [],
};

/**
 * Todo lo que «Mi perfil» consulta al abrirse.
 *
 * Están todas a propósito: una ruta sin simular responde 404 y provoca un re-render justo
 * cuando el test va a hacer clic, y el test falla una de cada tantas veces por eso.
 */
const rutasBase = {
  'GET /identity/mi-perfil': { status: 200, cuerpo: PERFIL },
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
};

/** jsdom no implementa las URL de objeto, que es como el navegador entrega una descarga. */
function espiarDescarga() {
  const crear = vi.fn(() => 'blob:mis-datos');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() }));
  const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { crear, clic };
}

describe('Mis datos y mi cuenta', () => {
  it('descarga el archivo que arma el gateway, con el nombre que él decide', async () => {
    const { clic } = espiarDescarga();
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, {
      ...rutasBase,
      'GET /datos/exportar': { status: 200, cuerpo: { servicios: [] } },
    });
    renderizar(<App />, { ruta: '/mi-perfil' });

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar mis datos' }));

    await waitFor(() => expect(clic).toHaveBeenCalled());
    expect(api.veces('GET /datos/exportar')).toBe(1);
  });

  it('avisa si el archivo no se pudo preparar, en vez de quedarse en silencio', async () => {
    espiarDescarga();
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      ...rutasBase,
      'GET /datos/exportar': { status: 502, cuerpo: { mensaje: 'learning-service no responde' } },
    });
    renderizar(<App />, { ruta: '/mi-perfil' });

    await userEvent.click(await screen.findByRole('button', { name: 'Descargar mis datos' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos preparar tu archivo/i);
  });

  it('no deja eliminar la cuenta hasta escribir la frase completa', async () => {
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/mi-perfil' });

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));

    const confirmar = screen.getAllByRole('button', { name: 'Eliminar mi cuenta' })[1]!;
    expect(confirmar).toBeDisabled();

    const campo = screen.getByLabelText(/para confirmar/i);
    await userEvent.type(campo, 'eliminar mi');
    expect(confirmar).toBeDisabled();

    await userEvent.type(campo, ' cuenta');
    expect(confirmar).toBeEnabled();
    expect(api.veces('DELETE /datos/suprimir')).toBe(0);
  });

  it('dice qué se conserva antes de pedir la confirmación, no después', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/mi-perfil' });

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent(/talleres que dictaste/i);
    expect(dialogo).toHaveTextContent(/auditoría/i);
    expect(dialogo).toHaveTextContent(/no se puede deshacer/i);
  });

  it('al eliminar, cierra la sesión y vuelve al login', async () => {
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, {
      ...rutasBase,
      'DELETE /datos/suprimir': { status: 200, cuerpo: { servicios: [] } },
    });
    renderizar(<App />, { ruta: '/mi-perfil' });

    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar mi cuenta' }));
    await userEvent.type(screen.getByLabelText(/para confirmar/i), CONFIRMACION_SUPRESION);
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar mi cuenta' })[1]!);

    await waitFor(() => expect(api.veces('POST /auth/logout')).toBe(1));
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('una cuenta del equipo ENACTIVA puede descargar, pero no eliminarse', async () => {
    // Quien administra no tiene «Mi perfil»: sus datos viven en «Mi cuenta» (2026-11-11).
    simularSesionIniciada(ADMIN_PRINCIPAL, rutasBase);
    renderizar(<App />, { ruta: '/mi-cuenta' });

    expect(await screen.findByRole('button', { name: 'Descargar mis datos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar mi cuenta' })).not.toBeInTheDocument();
    expect(screen.getByText(/pídelo al Admin Principal/i)).toBeInTheDocument();
  });
});
