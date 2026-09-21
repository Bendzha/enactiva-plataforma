import type { EmpresaDetalle, EmpresaResumen } from '@enactiva/shared';
import { screen, waitFor, within } from '@testing-library/react';
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

const PLANTA_NORTE: EmpresaResumen = {
  id: '11111111-1111-7111-8111-111111111111',
  nombre: 'Planta Norte S.A.',
  rubro: 'Minería',
  estado: 'ACTIVA',
  activadaAt: '2026-08-12T12:00:00.000Z',
  personasActivas: 18,
};

const TECHSERVICE: EmpresaResumen = {
  id: '22222222-2222-7222-8222-222222222222',
  nombre: 'TechService Ltda.',
  rubro: 'Servicios TI',
  estado: 'ONBOARDING_PENDIENTE',
  activadaAt: null,
  personasActivas: 0,
};

const DETALLE_TECHSERVICE: EmpresaDetalle = {
  ...TECHSERVICE,
  createdAt: '2026-09-01T12:00:00.000Z',
  contactoRrhh: {
    id: 'c-1',
    email: 'contacto@techservice.cl',
    nombre: null,
    apellido: null,
    estado: 'INVITADO',
    invitacionExpiraAt: '2026-09-28T12:00:00.000Z',
  },
};

describe('Panel de empresas', () => {
  it('muestra las empresas del piloto con sus indicadores reales', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /empresas': { status: 200, cuerpo: [PLANTA_NORTE, TECHSERVICE] },
    });
    renderizar(<App />, { ruta: '/empresas' });

    expect(await screen.findByText('Planta Norte S.A.')).toBeInTheDocument();
    expect(screen.getByText('TechService Ltda.')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();

    // KPIs calculados con datos reales, sin inventar el logro.
    expect(screen.getByRole('heading', { name: 'Empresas piloto' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Empresas piloto' })).getByText('2'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Personas activas' })).getByText('18'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Logro promedio global' })).getByText(
        'Aún sin mediciones',
      ),
    ).toBeInTheDocument();
  });

  it('cuando no hay empresas invita a cargar la primera', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, { 'GET /empresas': { status: 200, cuerpo: [] } });
    renderizar(<App />, { ruta: '/empresas' });

    expect(await screen.findByText('Aún no hay empresas en el piloto')).toBeInTheDocument();
  });

  it('valida el formulario antes de llamar a la API', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /empresas': { status: 200, cuerpo: [] },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/empresas' });

    await usuario.click(await screen.findByRole('button', { name: '+ Agregar empresa' }));
    await usuario.type(screen.getByLabelText('Nombre de la empresa'), 'Nueva empresa');
    await usuario.type(screen.getByLabelText('Rubro'), 'Retail');
    await usuario.type(screen.getByLabelText('Contacto de RRHH (email)'), 'sin-arroba');
    await usuario.click(screen.getByRole('button', { name: 'Agregar empresa' }));

    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
    expect(api.veces('POST /empresas')).toBe(0);
  });

  it('agrega una empresa y confirma que se envió la invitación', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /empresas': { status: 200, cuerpo: [] },
      'POST /empresas': { status: 201, cuerpo: DETALLE_TECHSERVICE },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/empresas' });

    await usuario.click(await screen.findByRole('button', { name: '+ Agregar empresa' }));
    await usuario.type(screen.getByLabelText('Nombre de la empresa'), 'TechService Ltda.');
    await usuario.type(screen.getByLabelText('Rubro'), 'Servicios TI');
    await usuario.type(
      screen.getByLabelText('Contacto de RRHH (email)'),
      'contacto@techservice.cl',
    );
    await usuario.click(screen.getByRole('button', { name: 'Agregar empresa' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/recibió la invitación/i);
    expect(api.veces('POST /empresas')).toBe(1);
    // Se vuelve a pedir el listado para no mostrar datos viejos.
    await waitFor(() => expect(api.veces('GET /empresas')).toBeGreaterThan(1));
  });

  it('avisa cuando el email del contacto ya tiene cuenta', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /empresas': { status: 200, cuerpo: [] },
      'POST /empresas': { status: 409, cuerpo: { message: 'Ya existe una cuenta con ese email' } },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/empresas' });

    await usuario.click(await screen.findByRole('button', { name: '+ Agregar empresa' }));
    await usuario.type(screen.getByLabelText('Nombre de la empresa'), 'Otra empresa');
    await usuario.type(screen.getByLabelText('Rubro'), 'Salud');
    await usuario.type(screen.getByLabelText('Contacto de RRHH (email)'), 'tomado@empresa.cl');
    await usuario.click(screen.getByRole('button', { name: 'Agregar empresa' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ese email ya tiene una cuenta');
  });

  it('el Admin Principal abre la ficha y puede activar la empresa', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /empresas': { status: 200, cuerpo: [TECHSERVICE] },
      [`GET /empresas/${TECHSERVICE.id}`]: { status: 200, cuerpo: DETALLE_TECHSERVICE },
      [`PATCH /empresas/${TECHSERVICE.id}/activar`]: {
        status: 200,
        cuerpo: {
          ...DETALLE_TECHSERVICE,
          estado: 'ACTIVA',
          activadaAt: '2026-09-21T12:00:00.000Z',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/empresas' });

    await usuario.click(await screen.findByRole('button', { name: /TechService Ltda./ }));

    const ficha = await screen.findByRole('dialog');
    expect(within(ficha).getByText('contacto@techservice.cl')).toBeInTheDocument();
    expect(within(ficha).getByText(/Invitación enviada/)).toBeInTheDocument();

    await usuario.click(within(ficha).getByRole('button', { name: 'Activar empresa' }));

    expect(await within(ficha).findByRole('status')).toHaveTextContent('Empresa activada');
    expect(api.veces(`PATCH /empresas/${TECHSERVICE.id}/activar`)).toBe(1);
  });

  it('el Admin Operativo no ve el botón de activar, pero sí el de reenviar la invitación', async () => {
    simularSesionIniciada(ADMIN_OPERATIVO, {
      'GET /empresas': { status: 200, cuerpo: [TECHSERVICE] },
      [`GET /empresas/${TECHSERVICE.id}`]: { status: 200, cuerpo: DETALLE_TECHSERVICE },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/empresas' });

    await usuario.click(await screen.findByRole('button', { name: /TechService Ltda./ }));

    const ficha = await screen.findByRole('dialog');
    expect(
      within(ficha).queryByRole('button', { name: 'Activar empresa' }),
    ).not.toBeInTheDocument();
    expect(within(ficha).getByRole('button', { name: 'Reenviar invitación' })).toBeInTheDocument();
  });
});
