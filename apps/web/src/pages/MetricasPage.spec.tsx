import type {
  EmpresaResumen,
  MetricasDeMatchesGlobales,
  MetricasDeValoracionesGlobales,
  MetricasGlobales,
} from '@enactiva/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { ADMIN_PRINCIPAL, renderizar, simularSesionIniciada } from '@/test/utilidades';

afterEach(() => {
  vi.unstubAllGlobals();
});

const EMPRESAS: EmpresaResumen[] = [
  {
    id: 'e-1',
    nombre: 'Planta Norte',
    rubro: 'Minería',
    estado: 'ACTIVA',
    activadaAt: '2026-09-20T12:00:00.000Z',
    personasActivas: 12,
  },
  {
    id: 'e-2',
    nombre: 'Grupo Andesco',
    rubro: 'Retail',
    estado: 'ONBOARDING_PENDIENTE',
    activadaAt: null,
    personasActivas: 0,
  },
];

const GLOBALES: MetricasGlobales = {
  personasActivas: 12,
  personasConPerfil: 7,
  temas: 9,
  declaraciones: 23,
  empresas: [
    {
      empresaId: 'e-1',
      nombre: 'Planta Norte',
      personasActivas: 12,
      personasConPerfil: 7,
      temas: 9,
      declaraciones: 23,
      brechas: 2,
    },
  ],
};

/** Dos respuestas en un match: una parte dijo que no repetiría. */
const MATCHES: MetricasDeMatchesGlobales = {
  matches: 4,
  matchesConRespuesta: 3,
  respuestas: 4,
  empresas: [
    {
      empresaId: 'e-1',
      matches: 4,
      respuestas: 4,
      matchesConRespuesta: 3,
      seReunieron: 4,
      aLaHoraAcordada: 3,
      comoLoEsperaban: 4,
      repetirian: 3,
    },
  ],
};

const VALORACIONES: MetricasDeValoracionesGlobales = {
  talleresTerminados: 5,
  valoraciones: 11,
  promedio: 4.4,
  empresas: [
    {
      empresaId: 'e-1',
      talleresTerminados: 5,
      talleresValorados: 3,
      valoraciones: 11,
      promedio: 4.4,
      porDimension: [
        { dimension: 'CLARIDAD', estrellas: 4.6 },
        { dimension: 'SEGURIDAD', estrellas: 4.2 },
      ],
    },
  ],
};

/** Lo que responden los tres servicios cuando el piloto todavía no tiene actividad. */
const VACIO = {
  'GET /matching/metricas/matches/globales': {
    status: 200,
    cuerpo: { matches: 0, matchesConRespuesta: 0, respuestas: 0, empresas: [] },
  },
  'GET /learning/metricas/valoraciones/globales': {
    status: 200,
    cuerpo: { talleresTerminados: 0, valoraciones: 0, promedio: null, empresas: [] },
  },
};

describe('Métricas globales del piloto', () => {
  it('muestra los intereses declarados y las brechas de cada empresa', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /identity/empresas': { status: 200, cuerpo: EMPRESAS },
      'GET /identity/metricas/globales': { status: 200, cuerpo: GLOBALES },
      ...VACIO,
    });
    renderizar(<App />, { ruta: '/metricas' });

    // Se espera a que llegue la tabla: los KPI ya existen antes, mostrando un guion.
    const fila = await screen.findByRole('row', { name: /Planta Norte/ });

    expect(
      within(screen.getByRole('group', { name: 'Personas con perfil' })).getByText('7'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: 'Declaraciones' })).getByText('23'),
    ).toBeInTheDocument();

    expect(within(fila).getByText('7 de 12')).toBeInTheDocument();
    expect(within(fila).getByText('2')).toBeInTheDocument();
  });

  it('no inventa cifras de logro mientras no haya mediciones', async () => {
    simularSesionIniciada(ADMIN_PRINCIPAL, {
      'GET /identity/empresas': { status: 200, cuerpo: EMPRESAS },
      'GET /identity/metricas/globales': { status: 200, cuerpo: GLOBALES },
      ...VACIO,
    });
    renderizar(<App />, { ruta: '/metricas' });

    // La tarjeta de "logro por empresa" se fue con el modelo de evaluación (ADR-0010): la
    // clienta lo sacó del alcance y dejarla reservaba espacio para algo que no va a existir.
    await screen.findByRole('heading', { name: 'Métricas globales' });
    expect(screen.queryByText(/logro por empresa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mediciones/i)).not.toBeInTheDocument();
  });

  describe('el dashboard del Admin Principal (criterio 5 de SPEC §10)', () => {
    const conTodo = () =>
      simularSesionIniciada(ADMIN_PRINCIPAL, {
        'GET /identity/empresas': { status: 200, cuerpo: EMPRESAS },
        'GET /identity/metricas/globales': { status: 200, cuerpo: GLOBALES },
        'GET /matching/metricas/matches/globales': { status: 200, cuerpo: MATCHES },
        'GET /learning/metricas/valoraciones/globales': { status: 200, cuerpo: VALORACIONES },
      });

    it('pone nombre a cada empresa, que matching y learning no conocen', async () => {
      conTodo();
      renderizar(<App />, { ruta: '/metricas' });

      // Las dos tablas nuevas llegan con `empresaId` y sin nombre: el cruce lo hace la pantalla.
      const matches = await screen.findByRole('table', { name: 'Puntuación de los matches' });
      const valoraciones = screen.getByRole('table', { name: 'Valoración de los talleres' });

      expect(within(matches).getByText('Planta Norte')).toBeInTheDocument();
      expect(within(valoraciones).getByText('Planta Norte')).toBeInTheDocument();
    });

    it('cuenta los «sí» sobre las respuestas, no sobre los matches', async () => {
      conTodo();
      renderizar(<App />, { ruta: '/metricas' });

      const tabla = await screen.findByRole('table', { name: 'Puntuación de los matches' });
      const fila = within(tabla).getByRole('row', { name: /Planta Norte/ });

      // 4 de 4 respuestas se reunieron, 3 de 4 repetirían. Si el denominador fueran los matches
      // puntuados (3), «se reunieron» daría 133 %.
      expect(within(fila).getAllByText('100%')).toHaveLength(2);
      expect(within(fila).getAllByText('75%')).toHaveLength(2);
      expect(within(fila).getAllByText('(3/4)')).toHaveLength(2);
      expect(within(fila).getAllByText('(4/4)')).toHaveLength(2);
    });

    it('promedia las estrellas por empresa y marca con una raya lo que nadie puntuó', async () => {
      conTodo();
      renderizar(<App />, { ruta: '/metricas' });

      const tabla = await screen.findByRole('table', { name: 'Valoración de los talleres' });
      const fila = within(tabla).getByRole('row', { name: /Planta Norte/ });

      expect(within(fila).getByText('4.4 ★')).toBeInTheDocument();
      expect(within(fila).getByText('3 de 5')).toBeInTheDocument();
      expect(within(fila).getByText('4.6')).toBeInTheDocument();
      // Dos dimensiones sin puntuar: una raya, no un 0.0, que se leería como una mala nota.
      expect(within(fila).getAllByText('—')).toHaveLength(2);
    });

    it('sin datos no muestra cifras de ejemplo', async () => {
      simularSesionIniciada(ADMIN_PRINCIPAL, {
        'GET /identity/empresas': { status: 200, cuerpo: EMPRESAS },
        'GET /identity/metricas/globales': { status: 200, cuerpo: GLOBALES },
        ...VACIO,
      });
      renderizar(<App />, { ruta: '/metricas' });

      expect(await screen.findByText(/Todavía no hay matches en el piloto/)).toBeInTheDocument();
      expect(screen.getByText(/Todavía no termina ningún taller/)).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: 'Puntuación de los matches' })).toBeNull();
    });

    it('si un servicio falla, lo dice y no deja la tabla a medias', async () => {
      simularSesionIniciada(ADMIN_PRINCIPAL, {
        'GET /identity/empresas': { status: 200, cuerpo: EMPRESAS },
        'GET /identity/metricas/globales': { status: 200, cuerpo: GLOBALES },
        'GET /matching/metricas/matches/globales': { status: 500, cuerpo: {} },
        'GET /learning/metricas/valoraciones/globales': { status: 200, cuerpo: VALORACIONES },
      });
      renderizar(<App />, { ruta: '/metricas' });

      expect(
        await screen.findByText(/No pudimos cargar las puntuaciones de los matches/),
      ).toBeInTheDocument();
      // Lo que sí llegó se sigue viendo: un servicio caído no apaga la pantalla entera.
      expect(screen.getByRole('table', { name: 'Valoración de los talleres' })).toBeInTheDocument();
    });
  });
});
