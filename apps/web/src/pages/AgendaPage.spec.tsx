import type { Agenda, ItemAgenda } from '@enactiva/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ADMIN_PRINCIPAL,
  CAPACITADOR_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const enHoras = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

const DICTO: ItemAgenda = {
  tallerId: 't-1',
  temaNombre: 'Excel avanzado',
  nombre: 'Excel para turnos',
  ubicacion: 'Sala de reuniones',
  inicioAt: enHoras(72),
  finAt: enHoras(74),
  papel: 'DICTO',
  inscritos: 3,
  cupo: 8,
};

const VOY_MANANA: ItemAgenda = {
  ...DICTO,
  tallerId: 't-2',
  nombre: 'Primeros auxilios',
  papel: 'VOY',
  inicioAt: enHoras(30),
  finAt: enHoras(32),
};

const PASADO: ItemAgenda = {
  ...DICTO,
  tallerId: 't-3',
  nombre: 'Tableros sin misterio',
  papel: 'VOY',
  inicioAt: enHoras(-50),
  finAt: enHoras(-48),
};

const AGENDA: Agenda = { proximos: [VOY_MANANA, DICTO], pasados: [PASADO] };

describe('Mi agenda', () => {
  it('muestra en una sola lista lo que dicta y a lo que va', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
    });
    renderizar(<App />, { ruta: '/agenda' });

    const primero = await screen.findByText('Primeros auxilios');
    expect(primero).toBeInTheDocument();
    expect(screen.getByText('Excel para turnos')).toBeInTheDocument();
    expect(screen.getByText('Lo dictas tú')).toBeInTheDocument();
    expect(screen.getAllByText('Vas a asistir')).toHaveLength(2);
  });

  it('dice cuánto falta en palabras', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
    });
    renderizar(<App />, { ruta: '/agenda' });

    expect(await screen.findByText('Mañana')).toBeInTheDocument();
  });

  it('separa el historial de lo que viene', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
    });
    renderizar(<App />, { ruta: '/agenda' });

    expect(await screen.findByRole('heading', { name: 'Lo que viene' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ya ocurrieron' })).toBeInTheDocument();
    expect(screen.getByText('Tableros sin misterio')).toBeInTheDocument();
  });

  it('avisa que van a llegar recordatorios por correo', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
    });
    renderizar(<App />, { ruta: '/agenda' });

    expect(
      await screen.findByText(/recordatorio por correo el día antes y una hora antes/),
    ).toBeInTheDocument();
  });

  it('con la agenda vacía ofrece ir a descubrir talleres', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      'GET /learning/agenda': { status: 200, cuerpo: { proximos: [], pasados: [] } },
    });
    renderizar(<App />, { ruta: '/agenda' });

    expect(
      await screen.findByRole('heading', { name: 'No tienes nada agendado' }),
    ).toBeInTheDocument();
    const vacio = screen.getByRole('link', { name: 'Descubrir talleres' });
    expect(vacio).toHaveAttribute('href', '/descubrir');
  });

  it('el equipo de ENACTIVA no tiene agenda', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
    });
    renderizar(<App />, { ruta: '/agenda' });

    expect(
      await screen.findByRole('heading', { name: 'Tu cuenta es del equipo ENACTIVA' }),
    ).toBeInTheDocument();
    expect(api.veces('GET /learning/agenda')).toBe(0);
  });

  it('el historial muestra el taller con su papel', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
    });
    renderizar(<App />, { ruta: '/agenda' });

    await screen.findByRole('heading', { name: 'Ya ocurrieron' });
    const fila = screen.getByText('Tableros sin misterio').closest('li')!;
    expect(within(fila).getByText('Vas a asistir')).toBeInTheDocument();
  });
});
