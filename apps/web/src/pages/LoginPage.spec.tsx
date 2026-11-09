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

    await usuario.type(await screen.findByLabelText('Correo de la empresa'), 'sin-arroba');
    await usuario.type(screen.getByLabelText('Contraseña'), 'una-clave');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

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

    await usuario.type(
      await screen.findByLabelText('Correo de la empresa'),
      'admin@plataforma.local',
    );
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave-equivocada');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o contraseña incorrectos.');
  });

  it('el enlace para recuperar la contraseña lleva a su pantalla', async () => {
    simularApi({ '/auth/refresh': { status: 401 } });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/login' });

    await usuario.click(await screen.findByRole('link', { name: /olvidaste tu contraseña/i }));

    expect(
      await screen.findByRole('heading', { name: '¿Olvidaste tu contraseña?' }),
    ).toBeInTheDocument();
  });

  it('«Entro como» decide la pantalla, pero no lo que la cuenta puede hacer', async () => {
    simularApi({
      '/auth/refresh': { status: 401 },
      '/auth/login': {
        status: 200,
        cuerpo: { accessToken: 'token-de-prueba', usuario: ADMIN_PRINCIPAL },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/login' });

    // El Admin de ENACTIVA no es de ninguna empresa: aunque elija «Trabajador/a», Descubrir no
    // tiene nada que mostrarle y cae donde le corresponde por su rol.
    await usuario.click(await screen.findByRole('button', { name: 'Trabajador/a' }));
    await usuario.type(screen.getByLabelText('Correo de la empresa'), 'principal@plataforma.local');
    await usuario.type(screen.getByLabelText('Contraseña'), 'la-clave-correcta');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Empresas piloto' })).toBeInTheDocument();
    });
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

    await usuario.type(
      await screen.findByLabelText('Correo de la empresa'),
      'principal@plataforma.local',
    );
    await usuario.type(screen.getByLabelText('Contraseña'), 'la-clave-correcta');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Empresas piloto' })).toBeInTheDocument();
    });
  });
});
