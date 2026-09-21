import type { AreaResumen, PersonaResumen } from '@enactiva/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { ADMIN_PRINCIPAL, renderizar, RRHH_PLANTA, simularSesionIniciada } from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const ID_AREA = '33333333-3333-7333-8333-333333333333';
const AREAS: AreaResumen[] = [{ id: ID_AREA, nombre: 'Operaciones', personas: 2 }];

const MARCELA: PersonaResumen = {
  id: 'p-1',
  email: 'marcela@planta-norte.cl',
  nombre: 'Marcela',
  apellido: 'Ruiz',
  cargo: 'Jefa de RRHH',
  areaId: null,
  areaNombre: null,
  roles: ['RRHH'],
  estado: 'ACTIVO',
  invitacionExpiraAt: null,
};

const INVITADO: PersonaResumen = {
  id: 'p-2',
  email: 'luis.soto@planta-norte.cl',
  nombre: null,
  apellido: null,
  cargo: 'Supervisor',
  areaId: ID_AREA,
  areaNombre: 'Operaciones',
  roles: ['ESTUDIANTE', 'CAPACITADOR'],
  estado: 'INVITADO',
  invitacionExpiraAt: '2026-09-28T12:00:00.000Z',
};

const rutasBase = {
  'GET /personas': { status: 200, cuerpo: [MARCELA, INVITADO] },
  'GET /areas': { status: 200, cuerpo: AREAS },
};

describe('Pantalla de Personas (RRHH)', () => {
  it('muestra a la gente de la empresa con su área, roles y estado', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/personas' });

    expect(await screen.findByText('Marcela Ruiz')).toBeInTheDocument();
    expect(screen.getByText('luis.soto@planta-norte.cl')).toBeInTheDocument();
    expect(screen.getByText(/Operaciones · Supervisor/)).toBeInTheDocument();
    expect(screen.getByText('Invitada')).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Invitaciones pendientes' })).getByText('1'),
    ).toBeInTheDocument();
  });

  it('invita a una persona nueva con su rol y su área', async () => {
    const api = simularSesionIniciada(RRHH_PLANTA, {
      ...rutasBase,
      'POST /personas': { status: 201, cuerpo: INVITADO },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/personas' });

    await usuario.click(await screen.findByRole('button', { name: '+ Invitar persona' }));
    await usuario.type(screen.getByLabelText('Email'), 'luis.soto@planta-norte.cl');
    await usuario.click(screen.getByRole('checkbox', { name: 'Capacitador' }));
    await usuario.selectOptions(screen.getByLabelText('Área'), ID_AREA);
    await usuario.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Invitación enviada a');
    expect(api.veces('POST /personas')).toBe(1);
  });

  it('al subir un CSV muestra qué filas entran y cuáles fallan antes de confirmar', async () => {
    const api = simularSesionIniciada(RRHH_PLANTA, {
      ...rutasBase,
      'POST /personas/importar/vista-previa': {
        status: 200,
        cuerpo: {
          validas: 1,
          conError: 1,
          filas: [
            {
              fila: 2,
              email: 'ana@planta.cl',
              roles: ['ESTUDIANTE'],
              area: 'Calidad',
              areaNueva: true,
              cargo: null,
              error: null,
            },
            {
              fila: 3,
              email: 'roto',
              roles: ['ESTUDIANTE'],
              area: null,
              areaNueva: false,
              cargo: null,
              error: 'Email inválido',
            },
          ],
        },
      },
      'POST /personas/importar': {
        status: 201,
        cuerpo: { validas: 1, conError: 1, filas: [], invitadas: 1, areasCreadas: ['Calidad'] },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/personas' });

    await usuario.click(await screen.findByRole('button', { name: 'Importar CSV' }));
    const archivo = new File(
      ['email,roles\nana@planta.cl,ESTUDIANTE\nroto,ESTUDIANTE'],
      'gente.csv',
      {
        type: 'text/csv',
      },
    );
    await usuario.upload(screen.getByLabelText('Archivo CSV'), archivo);

    // La vista previa no escribe nada todavía.
    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
    expect(screen.getByText('Se invitará')).toBeInTheDocument();
    expect(screen.getByText(/\(nueva\)/)).toBeInTheDocument();
    expect(api.veces('POST /personas/importar')).toBe(0);

    await usuario.click(screen.getByRole('button', { name: 'Invitar a 1 personas' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Se invitó a 1 personas');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Se crearon las áreas: Calidad');
  });

  it('el equipo de ENACTIVA no administra la gente de las empresas', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /empresas': { status: 200, cuerpo: [] },
    });
    renderizar(<App />, { ruta: '/personas' });

    expect(
      await screen.findByRole('heading', { name: 'No tienes acceso a esta sección' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Personas' })).not.toBeInTheDocument();
  });

  it('RRHH no ve el panel de empresas del piloto', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/personas' });

    expect(await screen.findByRole('link', { name: 'Personas' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Empresas' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Métricas' })).not.toBeInTheDocument();
  });
});
