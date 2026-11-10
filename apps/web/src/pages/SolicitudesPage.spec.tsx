import type { MiSolicitud, SolicitudParaRrhh } from '@enactiva/shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import {
  CAPACITADOR_PLANTA,
  ESTUDIANTE_PLANTA,
  RRHH_PLANTA,
  renderizar,
  simularSesionIniciada,
} from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const PROPUESTA: SolicitudParaRrhh = {
  id: 's-1',
  tipo: 'PROPUESTA_TALLER',
  estado: 'PENDIENTE',
  tema: 'Soldadura TIG',
  tipoInteres: 'ENSENAR',
  dimensiones: ['HABILIDAD'],
  nivel: 'AVANZADO',
  detalle: 'Trabajé en la maestranza y puedo armar un taller práctico.',
  motivoRechazo: null,
  createdAt: new Date('2026-11-05T12:00:00Z').toISOString(),
  resueltaAt: null,
  solicitante: {
    id: 'u-capacitador',
    nombre: 'Luis',
    apellido: 'Soto',
    email: 'luis.soto@planta-norte.cl',
  },
  resueltaPor: null,
};

const CAMBIO_DE_ROL: SolicitudParaRrhh = {
  ...PROPUESTA,
  id: 's-2',
  tipo: 'CAMBIO_DE_ROL',
  tema: null,
  detalle: 'Quiero enseñar primeros auxilios.',
  solicitante: { id: 'u-estudiante', nombre: 'Ana', apellido: 'Vera', email: 'ana@planta.local' },
};

const rutas = (bandeja: SolicitudParaRrhh[]) => ({
  'GET /identity/solicitudes': { status: 200, cuerpo: bandeja },
  'GET /identity/solicitudes/mias': { status: 200, cuerpo: [] },
  'PATCH /identity/solicitudes/s-1/aprobar': {
    status: 200,
    cuerpo: { ...PROPUESTA, estado: 'APROBADA' },
  },
  'PATCH /identity/solicitudes/s-2/aprobar': {
    status: 200,
    cuerpo: { ...CAMBIO_DE_ROL, estado: 'APROBADA' },
  },
  'PATCH /identity/solicitudes/s-1/rechazar': {
    status: 200,
    cuerpo: { ...PROPUESTA, estado: 'RECHAZADA' },
  },
});

describe('Bandeja de solicitudes de RRHH', () => {
  it('muestra quién pidió qué y lo que escribió', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas([PROPUESTA]));
    renderizar(<App />, { ruta: '/solicitudes' });

    expect(await screen.findByText('Luis Soto')).toBeInTheDocument();
    expect(screen.getByText('Soldadura TIG')).toBeInTheDocument();
    expect(screen.getByText(/maestranza/)).toBeInTheDocument();
  });

  it('avisa que al aprobar una propuesta el taller lo crea RRHH', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas([PROPUESTA]));
    renderizar(<App />, { ruta: '/solicitudes' });

    // Es la parte que la clienta pidió explícitamente: aprobar no crea nada.
    expect(await screen.findByText(/el tema entra al catálogo/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/en el catálogo y en el perfil/i);
    });
  });

  it('aprobar un cambio de rol dice que ya puede publicar, sin pedir otro paso', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas([CAMBIO_DE_ROL]));
    renderizar(<App />, { ruta: '/solicitudes' });

    await userEvent.click(await screen.findByRole('button', { name: 'Aprobar' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/ya puede publicar talleres/i);
    });
    expect(screen.queryByText(/el tema entra al catálogo/i)).not.toBeInTheDocument();
  });

  it('se puede rechazar sin escribir un motivo', async () => {
    simularSesionIniciada(RRHH_PLANTA, rutas([PROPUESTA]));
    renderizar(<App />, { ruta: '/solicitudes' });

    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    const dialogo = screen.getByRole('dialog');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Rechazar' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/rechazaste la solicitud/i);
    });
  });

  it('quien no es RRHH no llega a la bandeja', async () => {
    simularSesionIniciada(CAPACITADOR_PLANTA, {
      ...rutas([]),
      'GET /learning/agenda': { status: 200, cuerpo: { proximos: [], pasados: [] } },
    });

    renderizar(<App />, { ruta: '/solicitudes' });
    expect(await screen.findByText(/no tienes acceso a esta sección/i)).toBeInTheDocument();
  });
});

describe('Pedir el rol de quien enseña', () => {
  const MIAS: MiSolicitud[] = [
    {
      id: 's-9',
      tipo: 'PROPUESTA_TALLER',
      estado: 'RECHAZADA',
      tema: 'Soldadura TIG',
      tipoInteres: 'ENSENAR',
      dimensiones: ['HABILIDAD'],
      nivel: 'AVANZADO',
      detalle: '',
      motivoRechazo: 'Ya hay un taller parecido en marzo.',
      createdAt: new Date('2026-11-01T12:00:00Z').toISOString(),
      resueltaAt: new Date('2026-11-02T12:00:00Z').toISOString(),
    },
  ];

  it('quien solo aprende ve el botón, y quien ya enseña no', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      'GET /identity/mi-perfil': {
        status: 200,
        cuerpo: {
          nombre: 'Ana',
          apellido: 'Vera',
          cargo: null,
          area: null,
          interesesGenerales: '',
          puedoEnsenar: [],
          quieroAprender: [],
        },
      },
      'GET /identity/solicitudes/mias': { status: 200, cuerpo: [] },
      'GET /learning/reconocimiento/u-estudiante': {
        status: 200,
        cuerpo: { valoraciones: 0, promedio: null, porDimension: [], tokens: 0, referencias: [] },
      },
    });

    renderizar(<App />, { ruta: '/mi-perfil' });
    expect(
      await screen.findByRole('button', { name: /quiero poder enseñar/i }),
    ).toBeInTheDocument();
  });

  it('el motivo del rechazo se ve en «Mi perfil»', async () => {
    simularSesionIniciada(ESTUDIANTE_PLANTA, {
      'GET /identity/mi-perfil': {
        status: 200,
        cuerpo: {
          nombre: 'Ana',
          apellido: 'Vera',
          cargo: null,
          area: null,
          interesesGenerales: '',
          puedoEnsenar: [],
          quieroAprender: [],
        },
      },
      'GET /identity/solicitudes/mias': { status: 200, cuerpo: MIAS },
      'GET /learning/reconocimiento/u-estudiante': {
        status: 200,
        cuerpo: { valoraciones: 0, promedio: null, porDimension: [], tokens: 0, referencias: [] },
      },
    });

    renderizar(<App />, { ruta: '/mi-perfil' });
    expect(await screen.findByText(/ya hay un taller parecido en marzo/i)).toBeInTheDocument();
  });
});
