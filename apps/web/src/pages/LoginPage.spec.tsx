import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { ADMIN_PRINCIPAL, renderizar, simularApi } from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Pantalla de login', () => {
  it('avisa cuando el email está mal escrito y no llama a la API', async () => {
    const { llamadas } = simularApi({ '/auth/refresh': { status: 401 } });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/login' });

    await usuario.type(await screen.findByLabelText('Email'), 'sin-arroba');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-clave');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
    expect(llamadas).not.toContain('/auth/login');
  });

  it('muestra un mensaje claro cuando las credenciales no son correctas', async () => {
    simularApi({
      '/auth/refresh': { status: 401 },
      '/auth/login': { status: 401, cuerpo: { message: 'Credenciales inválidas' } },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/login' });

    await usuario.type(await screen.findByLabelText('Email'), 'admin@plataforma.local');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-equivocada');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
  });

  it('con credenciales correctas entra y lleva a Empresas', async () => {
    simularApi({
      '/auth/refresh': { status: 401 },
      '/auth/login': {
        status: 200,
        cuerpo: { accessToken: 'token-de-prueba', usuario: ADMIN_PRINCIPAL },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/login' });

    await usuario.type(await screen.findByLabelText('Email'), 'principal@plataforma.local');
    await usuario.type(screen.getByLabelText('Contraseña'), 'la-clave-correcta');
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Empresas piloto' })).toBeInTheDocument();
    });
  });
});
