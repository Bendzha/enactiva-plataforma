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

  describe('«Mantener sesión iniciada» (SPEC §3.9)', () => {
    const entrar = async (marcar: boolean) => {
      const api = simularApi({
        '/auth/refresh': { status: 401 },
        '/auth/login': {
          status: 200,
          cuerpo: { accessToken: 'token-de-prueba', usuario: ADMIN_PRINCIPAL },
        },
      });
      const usuario = userEvent.setup();
      renderizar(<App />, { ruta: '/login' });

      const casilla = await screen.findByLabelText('Mantener sesión iniciada');
      // Desmarcada al cargar: el valor por omisión es el seguro.
      expect(casilla).not.toBeChecked();
      if (marcar) await usuario.click(casilla);

      await usuario.type(
        screen.getByLabelText('Correo de la empresa'),
        'principal@plataforma.local',
      );
      await usuario.type(screen.getByLabelText('Contraseña'), 'la-clave-correcta');
      await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

      await waitFor(() => expect(api.veces('POST /auth/login')).toBe(1));

      const llamada = api.fetchFalso.mock.calls.find(([url]) =>
        String(url).endsWith('/auth/login'),
      )!;
      return JSON.parse(String(llamada[1]!.body)) as { mantenerSesion: boolean };
    };

    it('sin marcarla, se pide la sesión que muere con el navegador', async () => {
      expect(await entrar(false)).toMatchObject({ mantenerSesion: false });
    });

    it('marcada, se pide que la sesión sobreviva al cierre', async () => {
      expect(await entrar(true)).toMatchObject({ mantenerSesion: true });
    });

    it('dice lo que hace y lo que no, sin prometer una sesión más larga', async () => {
      simularApi({ '/auth/refresh': { status: 401 } });
      renderizar(<App />, { ruta: '/login' });

      expect(
        await screen.findByText(/tu sesión se cierra al cerrar el navegador/i),
      ).toBeInTheDocument();
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
