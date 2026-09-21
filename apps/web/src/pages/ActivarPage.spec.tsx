import { AVISO_PRIVACIDAD_VERSION, type UsuarioSesion } from '@enactiva/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { renderizar, simularApi } from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const TOKEN = 'token-de-invitacion-de-prueba-123456';
const RUTA_ACTIVAR = `/activar?token=${TOKEN}`;

const MARCELA: UsuarioSesion = {
  id: 'u-rrhh',
  email: 'marcela@planta-norte.cl',
  nombre: 'Marcela',
  apellido: 'Ruiz',
  roles: ['RRHH'],
  nivelAdmin: null,
  empresaId: 'e-1',
};

const INVITACION_VALIDA = {
  status: 200,
  cuerpo: {
    email: MARCELA.email,
    nombreEmpresa: 'Planta Norte S.A.',
    versionAviso: AVISO_PRIVACIDAD_VERSION,
  },
};

describe('Activación de cuenta desde el correo', () => {
  it('muestra para qué empresa es la invitación y el aviso de privacidad', async () => {
    simularApi({ '/auth/refresh': { status: 401 }, '/invitaciones/estado': INVITACION_VALIDA });
    renderizar(<App />, { ruta: RUTA_ACTIVAR });

    expect(await screen.findByText(/Planta Norte S\.A\./)).toBeInTheDocument();
    expect(screen.getByText(/pendiente de aprobación por ENACTIVA/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Recursos Humanos de tu organización puede ver tus/i),
    ).toBeInTheDocument();
  });

  it('avisa si el enlace ya no sirve', async () => {
    simularApi({
      '/auth/refresh': { status: 401 },
      '/invitaciones/estado': {
        status: 410,
        cuerpo: { message: 'Esta invitación ya no es válida. Pide que te la reenvíen.' },
      },
    });
    renderizar(<App />, { ruta: RUTA_ACTIVAR });

    expect(await screen.findByText('Este enlace ya no sirve')).toBeInTheDocument();
    expect(screen.getByText(/Pide que te la reenvíen/)).toBeInTheDocument();
  });

  it('no deja activar sin aceptar el aviso de privacidad', async () => {
    const api = simularApi({
      '/auth/refresh': { status: 401 },
      '/invitaciones/estado': INVITACION_VALIDA,
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: RUTA_ACTIVAR });

    await usuario.type(await screen.findByLabelText('Nombre'), 'Marcela');
    await usuario.type(screen.getByLabelText('Apellido'), 'Ruiz');
    await usuario.type(screen.getByLabelText('Crea tu contraseña'), 'mi-clave-nueva-2026');
    await usuario.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));

    expect(await screen.findByText(/Debes aceptar el aviso de privacidad/)).toBeInTheDocument();
    expect(api.veces('POST /invitaciones/aceptar')).toBe(0);
  });

  it('exige una contraseña de al menos 12 caracteres', async () => {
    simularApi({ '/auth/refresh': { status: 401 }, '/invitaciones/estado': INVITACION_VALIDA });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: RUTA_ACTIVAR });

    await usuario.type(await screen.findByLabelText('Nombre'), 'Marcela');
    await usuario.type(screen.getByLabelText('Apellido'), 'Ruiz');
    await usuario.type(screen.getByLabelText('Crea tu contraseña'), 'corta');
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));

    expect(await screen.findByText(/al menos 12 caracteres/)).toBeInTheDocument();
  });

  it('activa la cuenta y entra directamente, sin volver a pedir la contraseña', async () => {
    const api = simularApi({
      '/auth/refresh': { status: 401 },
      '/invitaciones/estado': INVITACION_VALIDA,
      'POST /invitaciones/aceptar': {
        status: 200,
        cuerpo: { accessToken: 'token-de-prueba', usuario: MARCELA },
      },
      'GET /personas': { status: 200, cuerpo: [] },
      'GET /areas': { status: 200, cuerpo: [] },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: RUTA_ACTIVAR });

    await usuario.type(await screen.findByLabelText('Nombre'), 'Marcela');
    await usuario.type(screen.getByLabelText('Apellido'), 'Ruiz');
    await usuario.type(screen.getByLabelText('Crea tu contraseña'), 'mi-clave-nueva-2026');
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: 'Activar mi cuenta' }));

    // RRHH no administra el piloto: llega a su pantalla de Personas, no al panel de empresas.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Personas' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Empresas piloto' })).not.toBeInTheDocument();
    expect(api.veces('POST /invitaciones/aceptar')).toBe(1);
  });
});
