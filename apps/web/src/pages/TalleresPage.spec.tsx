import type { TallerResumen, TemaResumen } from '@enactiva/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
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
  { id: ID_TEMA, nombre: 'Excel avanzado', puedenEnsenar: 1, quierenAprender: 3 },
];

const enDias = (dias: number, hora = 10) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(hora, 0, 0, 0);
  return fecha.toISOString();
};

const TALLER_AJENO: TallerResumen = {
  id: 't-1',
  temaId: ID_TEMA,
  temaNombre: 'Excel avanzado',
  capacitadorId: 'otra-persona',
  nombre: 'Excel para turnos',
  objetivo: 'Armar la planilla de turnos sin pelearse con las fórmulas',
  resultadosEsperados: 'Salir con la planilla del mes lista',
  ubicacion: 'Sala de reuniones, segundo piso',
  inicioAt: enDias(7),
  finAt: enDias(7, 12),
  cupo: 10,
  inscritos: 3,
  cuposDisponibles: 7,
  empezado: false,
  esMio: false,
  inscrito: false,
};

const TALLER_LLENO: TallerResumen = {
  ...TALLER_AJENO,
  id: 't-2',
  nombre: 'Primeros auxilios',
  cupo: 4,
  inscritos: 4,
  cuposDisponibles: 0,
};

const TALLER_PROPIO: TallerResumen = {
  ...TALLER_AJENO,
  id: 't-3',
  nombre: 'Hablar en público',
  capacitadorId: CAPACITADOR_PLANTA.id,
  esMio: true,
};

const rutasBase = {
  'GET /learning/talleres': { status: 200, cuerpo: [TALLER_AJENO, TALLER_LLENO] },
  'GET /learning/talleres/mios': { status: 200, cuerpo: [TALLER_PROPIO] },
  'GET /learning/disponibilidad': { status: 200, cuerpo: [] },
  'GET /identity/temas': { status: 200, cuerpo: TEMAS },
};

describe('Talleres', () => {
  it('muestra la ficha completa de cada taller convocado', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/talleres' });

    expect(await screen.findByText('Excel para turnos')).toBeInTheDocument();
    expect(screen.getAllByText(/Sala de reuniones, segundo piso/)).toHaveLength(2);
    expect(screen.getByText(/3 de 10 inscritos/)).toBeInTheDocument();
    expect(screen.getByText('Sin cupos')).toBeInTheDocument();
  });

  it('quien no dicta talleres no ve el botón de publicar', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/talleres' });

    await screen.findByText('Excel para turnos');
    expect(screen.queryByRole('button', { name: '+ Publicar taller' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mi disponibilidad' })).not.toBeInTheDocument();
  });

  it('alguien se inscribe en un taller con cupo', async () => {
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, {
      ...rutasBase,
      'POST /learning/talleres/t-1/inscripcion': {
        status: 201,
        cuerpo: { ...TALLER_AJENO, inscritos: 4, cuposDisponibles: 6, inscrito: true },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/talleres' });

    await usuario.click((await screen.findAllByRole('button', { name: 'Inscribirme' }))[0]!);

    expect(await screen.findByRole('status')).toHaveTextContent('Quedaste inscrito');
    expect(api.veces('POST /learning/talleres/t-1/inscripcion')).toBe(1);
  });

  it('un taller sin cupos no deja inscribirse', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, rutasBase);
    renderizar(<App />, { ruta: '/talleres' });

    await screen.findByText('Primeros auxilios');
    const botones = screen.getAllByRole('button', { name: 'Inscribirme' });
    expect(botones[botones.length - 1]).toBeDisabled();
  });

  it('muestra el mensaje de la API cuando el taller se llenó entremedio', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      ...rutasBase,
      'POST /learning/talleres/t-1/inscripcion': {
        status: 409,
        cuerpo: { mensaje: 'El taller ya no tiene cupos' },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/talleres' });

    await usuario.click((await screen.findAllByRole('button', { name: 'Inscribirme' }))[0]!);

    expect(await screen.findByRole('status')).toHaveTextContent('El taller ya no tiene cupos');
  });

  it('un capacitador publica la ficha de un taller', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutasBase,
      'POST /learning/talleres': { status: 201, cuerpo: TALLER_PROPIO },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/talleres' });

    await usuario.click(await screen.findByRole('button', { name: '+ Publicar taller' }));

    await usuario.selectOptions(screen.getByLabelText('Tema'), ID_TEMA);
    await usuario.type(screen.getByLabelText('Nombre del taller'), 'Hablar en público');
    await usuario.type(screen.getByLabelText('Fecha'), '2027-03-15');
    await usuario.type(screen.getByLabelText('Desde'), '10:00');
    await usuario.type(screen.getByLabelText('Hasta'), '12:00');
    await usuario.type(screen.getByLabelText('¿Dónde se hace?'), 'Sala 3, edificio central');
    await usuario.type(
      screen.getByLabelText('Objetivo'),
      'Perderle el miedo a presentar frente al equipo',
    );
    await usuario.type(
      screen.getByLabelText('Resultados esperados'),
      'Presentar tres minutos sin leer',
    );
    await usuario.click(screen.getByRole('button', { name: 'Publicar taller' }));

    await waitFor(() => {
      expect(api.veces('POST /learning/talleres')).toBe(1);
    });
  });

  it('no publica una ficha incompleta', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, rutasBase);
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/talleres' });

    await usuario.click(await screen.findByRole('button', { name: '+ Publicar taller' }));
    await usuario.type(screen.getByLabelText('Nombre del taller'), 'Sin tema ni fecha');
    await usuario.click(screen.getByRole('button', { name: 'Publicar taller' }));

    expect(await screen.findByText('Elige un tema del catálogo')).toBeInTheDocument();
    expect(api.veces('POST /learning/talleres')).toBe(0);
  });

  it('el facilitador declara cuándo puede enseñar', async () => {
    const api = simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutasBase,
      'PUT /learning/disponibilidad': {
        status: 200,
        cuerpo: [{ dia: 'MARTES', horaInicio: '09:00', horaFin: '11:00' }],
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/talleres' });

    await usuario.click(await screen.findByRole('button', { name: 'Mi disponibilidad' }));
    await usuario.selectOptions(screen.getByLabelText('Día'), 'MARTES');
    await usuario.click(screen.getByRole('button', { name: '+ Agregar franja' }));

    expect(screen.getByText(/de 09:00 a 11:00/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Guardar disponibilidad' }));

    await waitFor(() => {
      expect(api.veces('PUT /learning/disponibilidad')).toBe(1);
    });
  });

  it('el equipo de ENACTIVA no convoca talleres', async () => {
    const api = simularSesionIniciada(
      { ...ESTUDIANTE_PLANTA, empresaId: null, roles: ['ADMIN_ENACTIVA'], nivelAdmin: 'PRINCIPAL' },
      rutasBase,
    );
    renderizar(<App />, { ruta: '/talleres' });

    expect(
      await screen.findByRole('heading', { name: 'Tu cuenta es del equipo ENACTIVA' }),
    ).toBeInTheDocument();
    expect(api.veces('GET /learning/talleres')).toBe(0);
  });
});
