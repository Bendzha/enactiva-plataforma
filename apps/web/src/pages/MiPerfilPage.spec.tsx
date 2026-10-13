import type { MiPerfil, TemaResumen } from '@enactiva/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ADMIN_PRINCIPAL,
  CAPACITADOR_PLANTA,
  ESTUDIANTE_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const ID_TEMA = '44444444-4444-7444-8444-444444444444';

const TEMAS: TemaResumen[] = [
  { id: ID_TEMA, nombre: 'Excel avanzado', puedenEnsenar: 2, quierenAprender: 5 },
];

const PERFIL: MiPerfil = {
  usuarioId: CAPACITADOR_PLANTA.id,
  nombre: 'Luis',
  apellido: 'Soto',
  cargo: 'Supervisor',
  areaNombre: 'Operaciones',
  interesesGenerales: 'Mejora de procesos',
  puedoEnsenar: [
    {
      id: 'i-1',
      temaId: ID_TEMA,
      temaNombre: 'Excel avanzado',
      tipo: 'ENSENAR',
      dimensiones: ['HABILIDAD', 'CONTENIDO'],
      nivel: 'AVANZADO',
    },
  ],
  quieroAprender: [],
};

const rutasBase = {
  'GET /identity/mi-perfil': { status: 200, cuerpo: PERFIL },
  'GET /identity/temas': { status: 200, cuerpo: TEMAS },
};

describe('Mi perfil', () => {
  it('muestra los datos del puesto y lo que la persona ya declaró', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByText('Supervisor')).toBeInTheDocument();
    expect(screen.getByText('Operaciones')).toBeInTheDocument();
    expect(screen.getByLabelText('Intereses generales')).toHaveValue('Mejora de procesos');

    expect(screen.getByText('Excel avanzado')).toBeInTheDocument();
    expect(screen.getByText('Habilidad')).toBeInTheDocument();
    expect(screen.getByText('Contenido')).toBeInTheDocument();
    expect(screen.getByText('Nivel avanzado')).toBeInTheDocument();
    expect(screen.getByText(/Todavía no declaraste nada que quieras aprender/)).toBeInTheDocument();
  });

  it('declara un tema que ya existe en el catálogo, con sus dimensiones y su nivel', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutasBase,
      'POST /identity/mi-perfil/intereses': {
        status: 201,
        cuerpo: {
          id: 'i-2',
          temaId: ID_TEMA,
          temaNombre: 'Excel avanzado',
          tipo: 'APRENDER',
          dimensiones: ['CONTENIDO'],
          nivel: 'BASICO',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/mi-perfil' });

    const secciones = await screen.findAllByRole('button', { name: '+ Agregar tema' });
    await usuario.click(secciones[1]!);

    await usuario.type(screen.getByLabelText('Tema'), 'excel');
    await usuario.click(await screen.findByRole('button', { name: /Excel avanzado/ }));
    await usuario.click(screen.getByRole('checkbox', { name: 'Contenido' }));
    await usuario.selectOptions(screen.getByLabelText('¿Desde dónde partes?'), 'BASICO');
    await usuario.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Agregamos "Excel avanzado"');
    expect(api.veces('POST /identity/mi-perfil/intereses')).toBe(1);
  });

  it('no deja declarar un tema sin elegir dimensión', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, rutasBase);
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/mi-perfil' });

    await usuario.click((await screen.findAllByRole('button', { name: '+ Agregar tema' }))[0]!);
    await usuario.click(await screen.findByRole('button', { name: /Excel avanzado/ }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar' }));

    expect(await screen.findByText('Elige al menos una dimensión')).toBeInTheDocument();
    expect(api.veces('POST /identity/mi-perfil/intereses')).toBe(0);
  });

  it('quien puede crear temas los suma al catálogo cuando no existen', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutasBase,
      'GET /identity/temas': { status: 200, cuerpo: [] },
      'POST /identity/temas': {
        status: 201,
        cuerpo: {
          id: '55555555-5555-7555-8555-555555555555',
          nombre: 'Hablar en público',
          puedenEnsenar: 0,
          quierenAprender: 0,
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/mi-perfil' });

    await usuario.click((await screen.findAllByRole('button', { name: '+ Agregar tema' }))[0]!);
    await usuario.type(screen.getByLabelText('Tema'), 'Hablar en público');
    await usuario.click(screen.getByRole('button', { name: /Crear el tema/ }));

    await waitFor(() => {
      expect(api.veces('POST /identity/temas')).toBe(1);
    });
  });

  it('quien no puede crear temas solo elige del catálogo', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      ...rutasBase,
      'GET /identity/temas': { status: 200, cuerpo: [] },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/mi-perfil' });

    await usuario.click((await screen.findAllByRole('button', { name: '+ Agregar tema' }))[0]!);
    await usuario.type(screen.getByLabelText('Tema'), 'Hablar en público');

    expect(screen.queryByRole('button', { name: /Crear el tema/ })).not.toBeInTheDocument();
    expect(await screen.findByText(/Pídele a RRHH/)).toBeInTheDocument();
  });

  it('el equipo de ENACTIVA no tiene perfil corporativo', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, rutasBase);
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(
      await screen.findByRole('heading', { name: 'Tu cuenta es del equipo ENACTIVA' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mi perfil' })).not.toBeInTheDocument();
    expect(api.veces('GET /identity/mi-perfil')).toBe(0);
  });
});
