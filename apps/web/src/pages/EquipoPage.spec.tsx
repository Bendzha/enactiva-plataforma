import type { AdminResumen } from '@enactiva/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ADMIN_OPERATIVO,
  ADMIN_PRINCIPAL,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const KARINA: AdminResumen = {
  id: ADMIN_PRINCIPAL.id,
  email: ADMIN_PRINCIPAL.email,
  nombre: 'Karina',
  apellido: 'López',
  nivelAdmin: 'PRINCIPAL',
  estado: 'ACTIVO',
  invitacionExpiraAt: null,
};

const COLABORADOR: AdminResumen = {
  id: 'a-2',
  email: 'operativo@enactiva.cl',
  nombre: null,
  apellido: null,
  nivelAdmin: 'OPERATIVO',
  estado: 'INVITADO',
  invitacionExpiraAt: '2026-09-28T12:00:00.000Z',
};

describe('Equipo ENACTIVA', () => {
  it('lista al equipo con su nivel y el estado de las invitaciones', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /admins': { status: 200, cuerpo: [KARINA, COLABORADOR] },
    });
    renderizar(<App />, { ruta: '/equipo' });

    expect(await screen.findByText('Karina López')).toBeInTheDocument();
    expect(screen.getByText('Principal')).toBeInTheDocument();
    expect(screen.getByText('operativo@enactiva.cl')).toBeInTheDocument();
    expect(screen.getByText('Invitación enviada')).toBeInTheDocument();
  });

  it('no ofrece quitarse el acceso a uno mismo', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /admins': { status: 200, cuerpo: [KARINA, COLABORADOR] },
    });
    renderizar(<App />, { ruta: '/equipo' });

    const filaPropia = (await screen.findByText('Karina López')).closest('li')!;
    expect(within(filaPropia).queryByRole('button', { name: 'Quitar acceso' })).toBeNull();

    const filaOtro = screen.getByText('operativo@enactiva.cl').closest('li')!;
    expect(within(filaOtro).getByRole('button', { name: 'Quitar acceso' })).toBeInTheDocument();
  });

  it('invita a alguien nuevo y confirma el envío', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /admins': { status: 200, cuerpo: [KARINA] },
      'POST /admins': { status: 201, cuerpo: COLABORADOR },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/equipo' });

    await usuario.click(await screen.findByRole('button', { name: '+ Invitar a alguien' }));
    await usuario.type(screen.getByLabelText('Email'), 'operativo@enactiva.cl');
    await usuario.selectOptions(screen.getByLabelText('Nivel de acceso'), 'OPERATIVO');
    await usuario.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Invitación enviada a');
    expect(api.veces('POST /admins')).toBe(1);
  });

  it('pide confirmación antes de quitar el acceso y explica qué implica', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /admins': { status: 200, cuerpo: [KARINA, COLABORADOR] },
      [`PATCH /admins/${COLABORADOR.id}/desactivar`]: {
        status: 200,
        cuerpo: { ...COLABORADOR, estado: 'SUSPENDIDO' },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/equipo' });

    const fila = (await screen.findByText('operativo@enactiva.cl')).closest('li')!;
    await usuario.click(within(fila).getByRole('button', { name: 'Quitar acceso' }));

    const confirmacion = await screen.findByRole('dialog');
    expect(
      within(confirmacion).getByText(/se cerrarán sus sesiones abiertas/i),
    ).toBeInTheDocument();

    await usuario.click(within(confirmacion).getByRole('button', { name: 'Quitar acceso' }));

    expect(await screen.findByRole('status')).toHaveTextContent('ya no tiene acceso');
    expect(api.veces(`PATCH /admins/${COLABORADOR.id}/desactivar`)).toBe(1);
  });

  it('el Admin Operativo no ve la pestaña Equipo ni puede entrar por la URL', async () => {
    simularSesionIniciada(ADMIN_OPERATIVO, { 'GET /empresas': { status: 200, cuerpo: [] } });
    renderizar(<App />, { ruta: '/equipo' });

    expect(
      await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Equipo' })).not.toBeInTheDocument();
  });
});
