import type { Personalizacion } from '@enactiva/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  document.documentElement.removeAttribute('style');
});

const LOGO = `data:image/png;base64,${'A'.repeat(60)}=`;
const PALETA = { marca: '#7A0030', acento: '#30C8A0', fondo: '#FFFBF5', texto: '#1A1A1A' };

const SIN_PERSONALIZAR: Personalizacion = {
  colores: null,
  logo: null,
  empresaNombre: 'Planta Norte',
};
const PERSONALIZADA: Personalizacion = {
  colores: PALETA,
  logo: LOGO,
  empresaNombre: 'Planta Norte',
};

const rutas = (personalizacion: Personalizacion) => ({
  'GET /identity/mi-empresa/personalizacion': { status: 200, cuerpo: personalizacion },
  'PUT /identity/mi-empresa/personalizacion': { status: 200, cuerpo: PERSONALIZADA },
  'DELETE /identity/mi-empresa/personalizacion': { status: 200, cuerpo: SIN_PERSONALIZAR },
  'GET /identity/personas': { status: 200, cuerpo: { personas: [], areas: [] } },
  'GET /identity/metricas/intereses': { status: 200, cuerpo: null },
});

const variable = (nombre: string) => document.documentElement.style.getPropertyValue(nombre);

describe('Los colores de la empresa', () => {
  it('se aplican como variables CSS al entrar', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas(PERSONALIZADA));
    renderizar(<App />, { ruta: '/personalizacion' });

    await waitFor(() => {
      expect(variable('--color-marca')).toBe('#7A0030');
    });
    expect(variable('--color-fondo')).toBe('#FFFBF5');
    // Los dos tonos derivados se calculan: no se le piden a nadie.
    expect(variable('--color-marca-oscuro')).toMatch(/^#[0-9a-f]{6}$/);
    expect(variable('--color-marca-suave')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('una empresa que no personalizó no pinta nada: se queda con la plantilla', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas(SIN_PERSONALIZAR));
    renderizar(<App />, { ruta: '/personalizacion' });

    expect(await screen.findByRole('heading', { name: /el entorno de/i })).toBeInTheDocument();
    expect(variable('--color-marca')).toBe('');
  });

  it('el equipo de ENACTIVA ni siquiera la pide: sus pantallas no cambian', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      ...rutas(PERSONALIZADA),
      'GET /identity/empresas': { status: 200, cuerpo: [] },
    });
    renderizar(<App />, { ruta: '/empresas' });

    await screen.findByRole('heading', { name: 'Empresas piloto' });
    expect(api.veces('GET /identity/mi-empresa/personalizacion')).toBe(0);
    expect(variable('--color-marca')).toBe('');
  });

  it('al cerrar sesión se despintan: el login no queda con los colores de la empresa', async () => {
    // Apareció probando en el navegador. La caché sobrevivía al cambio de sesión y la siguiente
    // persona que entraba en el mismo equipo heredaba la paleta de la empresa anterior.
    simularSesionIniciada(RRHH_PLANTA, rutas(PERSONALIZADA));
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/personalizacion' });

    await waitFor(() => expect(variable('--color-marca')).toBe('#7A0030'));

    await usuario.click(screen.getByRole('button', { name: 'Salir' }));

    await waitFor(() => expect(variable('--color-marca')).toBe(''));
  });

  it('el logo reemplaza a «ENACTIVA Match» dentro del entorno', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas(PERSONALIZADA));
    renderizar(<App />, { ruta: '/personalizacion' });

    expect(await screen.findByRole('img', { name: 'Planta Norte' })).toHaveAttribute('src', LOGO);
  });
});

describe('La pantalla del entorno', () => {
  it('avisa del contraste pero deja guardar igual', async () => {
    // La clienta dijo que el contraste lo ven ellos (ADR-0011): esto avisa, no bloquea.
    const api = simularSesionIniciada(RRHH_PLANTA, rutas(SIN_PERSONALIZAR));
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/personalizacion' });

    const hexTexto = await screen.findByLabelText('Texto en hexadecimal');
    await usuario.clear(hexTexto);
    await usuario.type(hexTexto, '#EEEEEE');

    expect(await screen.findByText(/ojo con el contraste/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => {
      expect(api.veces('PUT /identity/mi-empresa/personalizacion')).toBe(1);
    });
  });

  it('un color mal escrito no se manda', async () => {
    const api = simularSesionIniciada(RRHH_PLANTA, rutas(SIN_PERSONALIZAR));
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/personalizacion' });

    const hexMarca = await screen.findByLabelText('Color principal en hexadecimal');
    await usuario.clear(hexMarca);
    await usuario.type(hexMarca, 'rojo');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText(/hexadecimal/i)).toBeInTheDocument();
    expect(api.veces('PUT /identity/mi-empresa/personalizacion')).toBe(0);
  });

  it('se puede volver a la plantilla', async () => {
    const api = simularSesionIniciada(RRHH_PLANTA, rutas(PERSONALIZADA));
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/personalizacion' });

    await usuario.click(await screen.findByRole('button', { name: 'Volver a la plantilla' }));

    await waitFor(() => {
      expect(api.veces('DELETE /identity/mi-empresa/personalizacion')).toBe(1);
    });
    expect(await screen.findByText(/volvió a la plantilla/i)).toBeInTheDocument();
  });

  it('quien no es RRHH no entra', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutas(SIN_PERSONALIZAR));
    renderizar(<App />, { ruta: '/personalizacion' });

    expect(await screen.findByText(/no tienes acceso a esta sección/i)).toBeInTheDocument();
  });
});
