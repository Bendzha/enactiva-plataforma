import type { TarjetaMazo } from '@enactiva/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  ADMIN_PRINCIPAL,
  ESTUDIANTE_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const enDias = (dias: number, hora = 10) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(hora, 0, 0, 0);
  return fecha.toISOString();
};

const EXCEL: TarjetaMazo = {
  tallerId: 't-excel',
  temaId: 'tema-excel',
  temaNombre: 'Excel avanzado',
  nombre: 'Excel para turnos',
  objetivo: 'Armar la planilla de turnos sin pelearse con las fórmulas',
  resultadosEsperados: 'Salir con la planilla del mes lista',
  ubicacion: 'Sala de reuniones, segundo piso',
  inicioAt: enDias(4),
  finAt: enDias(4, 12),
  cupo: 8,
  inscritos: 3,
  cuposDisponibles: 5,
  facilitador: {
    id: 'u-luis',
    nombre: 'Luis Soto',
    cargo: 'Supervisor',
    area: 'Operaciones',
    mismaArea: true,
  },
  score: 100,
  porQue: 'querías aprender Excel avanzado · trabaja en tu área',
};

const INGLES: TarjetaMazo = {
  ...EXCEL,
  tallerId: 't-ingles',
  temaId: 'tema-ingles',
  temaNombre: 'Inglés técnico',
  nombre: 'Inglés para faena',
  score: 33,
  porQue: 'es un tema que no habías declarado',
  facilitador: { ...EXCEL.facilitador, id: 'u-carla', nombre: 'Carla Muñoz', mismaArea: false },
};

describe('Descubrir (el mazo del swipe)', () => {
  it('muestra una tarjeta a la vez, con quién la dicta y por qué aparece', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      'GET /matching/mazo': { status: 200, cuerpo: [EXCEL, INGLES] },
    });
    renderizar(<App />, { ruta: '/descubrir' });

    expect(await screen.findByText('Excel para turnos')).toBeInTheDocument();
    expect(screen.getByText('Luis Soto')).toBeInTheDocument();
    expect(screen.getByText(/Supervisor · Operaciones · tu área/)).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(
      screen.getByText(/querías aprender Excel avanzado · trabaja en tu área/),
    ).toBeInTheDocument();
    expect(screen.getByText('Quedan 2 por revisar')).toBeInTheDocument();

    // La siguiente no se muestra todavía: se decide de a una.
    expect(screen.queryByText('Inglés para faena')).not.toBeInTheDocument();
  });

  it('el me interesa inscribe y lo dice', async () => {
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, {
      'GET /matching/mazo': { status: 200, cuerpo: [EXCEL] },
      'POST /matching/mazo/t-excel/decision': {
        status: 201,
        cuerpo: {
          decision: 'INTERESADO',
          inscrito: true,
          mensaje: 'Quedaste inscrito en "Excel para turnos".',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/descubrir' });

    await usuario.click(await screen.findByRole('button', { name: '♥ Me interesa e inscribirme' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Quedaste inscrito');
    expect(api.veces('POST /matching/mazo/t-excel/decision')).toBe(1);
  });

  it('avisa cuando el cupo se llenó entremedio', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      'GET /matching/mazo': { status: 200, cuerpo: [EXCEL] },
      'POST /matching/mazo/t-excel/decision': {
        status: 201,
        cuerpo: {
          decision: 'INTERESADO',
          inscrito: false,
          mensaje: 'El taller ya no tiene cupos',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/descubrir' });

    await usuario.click(await screen.findByRole('button', { name: '♥ Me interesa e inscribirme' }));

    expect(await screen.findByRole('status')).toHaveTextContent('El taller ya no tiene cupos');
  });

  it('descartar no inscribe a nadie', async () => {
    const api = simularSesionIniciada(ESTUDIANTE_PLANTA, {
      'GET /matching/mazo': { status: 200, cuerpo: [EXCEL] },
      'POST /matching/mazo/t-excel/decision': {
        status: 201,
        cuerpo: {
          decision: 'DESCARTADO',
          inscrito: false,
          mensaje: 'Listo, no te lo volvemos a mostrar.',
        },
      },
    });
    const usuario = userEvent.setup();
    renderizar(<App />, { ruta: '/descubrir' });

    await usuario.click(await screen.findByRole('button', { name: '✕ No me interesa' }));

    await waitFor(() => {
      expect(api.veces('POST /matching/mazo/t-excel/decision')).toBe(1);
    });
    expect(screen.getByRole('status')).toHaveTextContent('no te lo volvemos a mostrar');
  });

  it('con el mazo vacío ofrece qué hacer en vez de dejar la pantalla en blanco', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      'GET /matching/mazo': { status: 200, cuerpo: [] },
    });
    renderizar(<App />, { ruta: '/descubrir' });

    expect(
      await screen.findByRole('heading', { name: 'No queda nada por decidir' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisar mi perfil' })).toBeInTheDocument();
  });

  it('el equipo de ENACTIVA no tiene mazo', async () => {
    const api = simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /matching/mazo': { status: 200, cuerpo: [EXCEL] },
    });
    renderizar(<App />, { ruta: '/descubrir' });

    expect(
      await screen.findByRole('heading', { name: 'Tu cuenta es del equipo ENACTIVA' }),
    ).toBeInTheDocument();
    expect(api.veces('GET /matching/mazo')).toBe(0);
  });
});
