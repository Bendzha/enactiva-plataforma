import type {
  Agenda,
  ItemAgenda,
  ReconocimientoPersona,
  ReferenciaPublicada,
} from '@enactiva/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  CAPACITADOR_PLANTA,
  RRHH_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const enHoras = (horas: number) => new Date(Date.now() + horas * 3_600_000).toISOString();

const PASADO: ItemAgenda = {
  tallerId: 't-3',
  temaNombre: 'Excel avanzado',
  nombre: 'Tableros sin misterio',
  ubicacion: 'Sala 1',
  inicioAt: enHoras(-50),
  finAt: enHoras(-48),
  papel: 'VOY',
  inscritos: 3,
  cupo: 8,
  puedeValorar: true,
};

const YA_VALORADO: ItemAgenda = {
  ...PASADO,
  tallerId: 't-4',
  nombre: 'Ya lo valoré',
  puedeValorar: false,
};

const AGENDA: Agenda = { proximos: [], pasados: [PASADO, YA_VALORADO] };

const rutasAgenda = (pendientes: string[] = []) => ({
  'GET /learning/agenda': { status: 200, cuerpo: AGENDA },
  'GET /matching/puntuaciones/pendientes': { status: 200, cuerpo: pendientes },
  'POST /learning/talleres/t-3/valoracion': { status: 201, cuerpo: { tallerId: 't-3' } },
  'POST /matching/talleres/t-3/puntuacion': { status: 201, cuerpo: { respuestas: [] } },
});

/** Las cuatro dimensiones, cada una en 4 estrellas. */
async function responderLasCuatro() {
  const grupos = screen.getAllByRole('radiogroup');
  for (const grupo of grupos) {
    await userEvent.click(within(grupo).getByRole('radio', { name: '4 de 5' }));
  }
}

describe('Valorar un taller', () => {
  it('solo ofrece valorar lo que ya ocurrió y todavía no valoré', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasAgenda());
    renderizar(<App />, { ruta: '/agenda' });

    await screen.findByText('Tableros sin misterio');
    expect(screen.getAllByRole('button', { name: 'Valorar' })).toHaveLength(1);
  });

  it('pide las cuatro preguntas de la clienta y no deja enviar a medias', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasAgenda());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Valorar' }));

    // Textuales del WhatsApp del 2026-09-29.
    expect(screen.getByText('Claridad')).toBeInTheDocument();
    expect(screen.getByText('¿Me sentí seguro en el taller?')).toBeInTheDocument();
    expect(screen.getByText('Aplicación')).toBeInTheDocument();
    expect(screen.getByText('Uso de materiales')).toBeInTheDocument();

    const enviar = screen.getByRole('button', { name: 'Enviar valoración' });
    expect(enviar).toBeDisabled();

    await responderLasCuatro();
    expect(enviar).toBeEnabled();
  });

  it('avisa que la referencia se publica con el nombre antes de escribirla', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasAgenda());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Valorar' }));

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent(/se publica dentro de tu empresa con tu nombre/i);
    expect(dialogo).toHaveTextContent(/RRHH puede ocultarla/i);
  });

  it('sin match pendiente, termina en un solo paso', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, rutasAgenda());
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Valorar' }));
    await responderLasCuatro();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar valoración' }));

    await waitFor(() => expect(api.veces('POST /learning/talleres/t-3/valoracion')).toBe(1));
    expect(await screen.findByText(/gracias por valorar/i)).toBeInTheDocument();
    expect(api.veces('POST /matching/talleres/t-3/puntuacion')).toBe(0);
  });

  it('después de valorar, el botón desaparece de la agenda', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutasAgenda(),
      // La segunda vez que se pide la agenda, el taller ya está valorado.
      'GET /learning/agenda': (() => {
        let llamadas = 0;
        return () => {
          llamadas += 1;
          return {
            status: 200,
            cuerpo:
              llamadas === 1
                ? AGENDA
                : { proximos: [], pasados: [{ ...PASADO, puedeValorar: false }, YA_VALORADO] },
          };
        };
      })(),
    });
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Valorar' }));
    await responderLasCuatro();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar valoración' }));

    await waitFor(() => expect(api.veces('GET /learning/agenda')).toBe(2));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Valorar' })).not.toBeInTheDocument(),
    );
  });

  it('con match pendiente, después pregunta si el emparejamiento funcionó', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, rutasAgenda(['t-3']));
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Valorar' }));
    await responderLasCuatro();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar valoración' }));

    // Las cuatro preguntas del WhatsApp, en su propio paso: miden otra cosa que las estrellas.
    expect(await screen.findByText('¿Se reunieron?')).toBeInTheDocument();
    expect(screen.getByText('¿Volverían a hacer match con esa persona?')).toBeInTheDocument();

    const listo = screen.getByRole('button', { name: 'Listo' });
    expect(listo).toBeDisabled();

    for (const grupo of screen.getAllByRole('radiogroup')) {
      await userEvent.click(within(grupo).getByRole('radio', { name: 'Sí' }));
    }
    await userEvent.click(listo);

    await waitFor(() => expect(api.veces('POST /matching/talleres/t-3/puntuacion')).toBe(1));
  });

  it('si la API rechaza la valoración, lo dice en vez de cerrarse', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutasAgenda(),
      'POST /learning/talleres/t-3/valoracion': {
        status: 409,
        cuerpo: { message: 'Ya valoraste este taller' },
      },
    });
    renderizar(<App />, { ruta: '/agenda' });

    await userEvent.click(await screen.findByRole('button', { name: 'Valorar' }));
    await responderLasCuatro();
    await userEvent.click(screen.getByRole('button', { name: 'Enviar valoración' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Ya valoraste este taller');
  });
});

const RECONOCIMIENTO: ReconocimientoPersona = {
  usuarioId: CAPACITADOR_PLANTA.id,
  tokens: 3,
  talleresDictados: 4,
  cuantasValoraciones: 2,
  promedioEstrellas: 4.5,
  cuentaEnElScore: false,
};

const REFERENCIA: ReferenciaPublicada = {
  id: 'r-1',
  tallerId: 't-3',
  tallerNombre: 'Tableros sin misterio',
  capacitadorId: CAPACITADOR_PLANTA.id,
  autorId: 'u-estudiante',
  autorNombre: 'Ana Vera',
  texto: 'Explicó todo con calma.',
  createdAt: enHoras(-40),
  oculta: false,
  motivoOcultada: null,
};

const rutasPerfil = (reconocimiento = RECONOCIMIENTO, referencias = [REFERENCIA]) => ({
  'GET /identity/mi-perfil': {
    status: 200,
    cuerpo: {
      usuarioId: CAPACITADOR_PLANTA.id,
      nombre: 'Luis',
      apellido: 'Soto',
      cargo: 'Supervisor',
      areaNombre: 'Operaciones',
      interesesGenerales: '',
      puedoEnsenar: [],
      quieroAprender: [],
    },
  },
  'GET /identity/temas': { status: 200, cuerpo: [] },
  [`GET /learning/personas/${CAPACITADOR_PLANTA.id}/reconocimiento`]: {
    status: 200,
    cuerpo: reconocimiento,
  },
  [`GET /learning/personas/${CAPACITADOR_PLANTA.id}/referencias`]: {
    status: 200,
    cuerpo: referencias,
  },
});

describe('Reconocimiento y referencias', () => {
  it('muestra tokens, talleres dictados y cómo lo valoran', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasPerfil());
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByText('3 ⭐')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('dice cuántas valoraciones faltan para que las estrellas pesen en Descubrir', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasPerfil());
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByText(/falta una valoración más/i)).toBeInTheDocument();
  });

  it('cuando ya cuenta, deja de avisar', async () => {
    simularSesionIniciada(
      CAPACITADOR_PLANTA,
      rutasPerfil({ ...RECONOCIMIENTO, cuantasValoraciones: 5, cuentaEnElScore: true }),
    );
    renderizar(<App />, { ruta: '/mi-perfil' });

    await screen.findByText('3 ⭐');
    expect(screen.queryByText(/para que tus estrellas influyan/i)).not.toBeInTheDocument();
  });

  it('las referencias van firmadas con el nombre de quien las escribió', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasPerfil());
    renderizar(<App />, { ruta: '/mi-perfil' });

    expect(await screen.findByText('Explicó todo con calma.')).toBeInTheDocument();
    expect(screen.getByText(/Ana Vera/)).toBeInTheDocument();
  });

  it('quien no modera no ve el botón de ocultar', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, rutasPerfil());
    renderizar(<App />, { ruta: '/mi-perfil' });

    await screen.findByText('Explicó todo con calma.');
    expect(screen.queryByRole('button', { name: 'Ocultar' })).not.toBeInTheDocument();
  });

  it('RRHH la oculta y tiene que explicar por qué', async () => {
    const rutas = rutasPerfil();
    const api = simularSesionIniciada(RRHH_PLANTA, {
      ...rutas,
      [`GET /learning/personas/${RRHH_PLANTA.id}/reconocimiento`]:
        rutas[`GET /learning/personas/${CAPACITADOR_PLANTA.id}/reconocimiento`]!,
      [`GET /learning/personas/${RRHH_PLANTA.id}/referencias`]:
        rutas[`GET /learning/personas/${CAPACITADOR_PLANTA.id}/referencias`]!,
      'POST /learning/referencias/r-1/ocultar': { status: 201, cuerpo: REFERENCIA },
    });
    renderizar(<App />, { ruta: '/mi-perfil' });

    await userEvent.click(await screen.findByRole('button', { name: 'Ocultar' }));

    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent(/no se borra/i);

    const confirmar = within(dialogo).getByRole('button', { name: 'Ocultar' });
    expect(confirmar).toBeDisabled();

    await userEvent.type(
      within(dialogo).getByLabelText(/por qué la ocultas/i),
      'Alude a una situación personal fuera del taller',
    );
    await userEvent.click(confirmar);

    await waitFor(() => expect(api.veces('POST /learning/referencias/r-1/ocultar')).toBe(1));
  });
});
