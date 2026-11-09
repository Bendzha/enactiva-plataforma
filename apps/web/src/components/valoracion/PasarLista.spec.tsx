import type { Agenda, ItemAgenda, ListaAsistencia } from '@enactiva/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { CAPACITADOR_PLANTA, renderizar, simularSesionIniciada } from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const enHoras = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

const DICTADO: ItemAgenda = {
  tallerId: 't-7',
  temaNombre: 'Mantención eléctrica',
  nombre: 'Tableros sin misterio',
  ubicacion: 'Taller de mantención',
  inicioAt: enHoras(-50),
  finAt: enHoras(-48),
  papel: 'DICTO',
  inscritos: 3,
  cupo: 6,
  puedeValorar: false,
  puedePasarLista: true,
};

const AGENDA: Agenda = { proximos: [], pasados: [DICTADO] };

const LISTA: ListaAsistencia = {
  tallerId: 't-7',
  tallerNombre: 'Tableros sin misterio',
  termino: true,
  cerradaAt: null,
  inscritos: [
    { usuarioId: 'u-1', nombre: 'Ana Vera', email: 'ana@planta.local', asistio: null },
    { usuarioId: 'u-2', nombre: 'Carla Muñoz', email: 'carla@planta.local', asistio: null },
    { usuarioId: 'u-3', nombre: 'Diego Paredes', email: 'diego@planta.local', asistio: null },
  ],
  tokensSiCierra: 2,
};

const rutas = (lista: ListaAsistencia = LISTA) => ({
  'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
  'GET /matching/puntuaciones/pendientes': { status: 200, cuerpo: [] },
  'GET /learning/talleres/t-7/asistencia': { status: 200, cuerpo: lista },
  'PUT /learning/talleres/t-7/asistencia': {
    status: 200,
    cuerpo: { lista, tokensParaQuienEnsena: 3, personasQueGanaronToken: 3 },
  },
});

describe('Pasar lista', () => {
  it('solo quien dictó el taller ve el botón', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutas());
    renderizar(<App />, { ruta: '/agenda' });

    expect(await screen.findByRole('button', { name: 'Pasar lista' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valorar' })).not.toBeInTheDocument();
  });

  it('muestra a los inscritos con su nombre y su correo', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutas());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar lista' }));

    expect(await screen.findByText('Ana Vera')).toBeInTheDocument();
    expect(screen.getByText('carla@planta.local')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('dice cuántos tokens va a repartir antes de cerrar', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutas());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar lista' }));
    await screen.findByText('Ana Vera');

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('Fueron 0 de 3');
    expect(dialogo).toHaveTextContent(/si van todos, ganas un token extra/i);

    for (const casilla of screen.getAllByRole('checkbox')) {
      await userEvent.click(casilla);
    }

    expect(dialogo).toHaveTextContent('Fueron 3 de 3');
    expect(dialogo).toHaveTextContent(/como fueron todos, ganas un token extra/i);
  });

  it('avisa que cerrar es definitivo', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutas());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar lista' }));
    await screen.findByText('Ana Vera');

    expect(screen.getByRole('dialog')).toHaveTextContent(/la lista ya no se cambia/i);
  });

  it('al cerrar cuenta lo que se repartió', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, rutas());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar lista' }));
    await screen.findByText('Ana Vera');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar y entregar tokens' }));

    await waitFor(() => expect(api.veces('PUT /learning/talleres/t-7/asistencia')).toBe(1));
    expect(await screen.findByText(/ganaste 3 tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/3 personas el suyo/i)).toBeInTheDocument();
  });

  it('guardar sin cerrar no anuncia tokens', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, rutas());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar lista' }));
    await screen.findByText('Ana Vera');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar sin cerrar' }));

    await waitFor(() => expect(api.veces('PUT /learning/talleres/t-7/asistencia')).toBe(1));
    expect(screen.queryByText(/ganaste/i)).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un taller sin inscritos lo dice en vez de mostrar una lista vacía', async () => {
    simularSesionIniciada(
      CAPACITADOR_PLANTA,
      rutas({ ...LISTA, inscritos: [], tokensSiCierra: 0 }),
    );
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar lista' }));

    expect(await screen.findByText(/no se inscribió nadie/i)).toBeInTheDocument();
  });

  it('si el servidor rechaza el cierre, lo dice y no cierra el diálogo', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutas(),
      'PUT /learning/talleres/t-7/asistencia': {
        status: 409,
        cuerpo: { message: 'La lista de este taller ya está cerrada' },
      },
    });
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Pasar lista' }));
    await screen.findByText('Ana Vera');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar y entregar tokens' }));

    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByRole('alert')).toHaveTextContent(/ya está cerrada/i);
  });
});
