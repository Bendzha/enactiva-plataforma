import type {
  MetricasDeMatchesGlobales,
  MetricasDeValoracionesGlobales,
  MetricasGlobales,
  MetricasIntereses,
} from '@enactiva/shared';
import { useQuery } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

/** Lo que RRHH ve de su propia empresa. */
export function useMetricasIntereses() {
  return useQuery({
    queryKey: ['metricas', 'intereses'],
    queryFn: () => pedir<MetricasIntereses>('/identity/metricas/intereses'),
  });
}

/** Lo que el Admin Principal ve del piloto completo. */
export function useMetricasGlobales() {
  return useQuery({
    queryKey: ['metricas', 'globales'],
    queryFn: () => pedir<MetricasGlobales>('/identity/metricas/globales'),
  });
}

/**
 * Las dos piezas del dashboard del Admin Principal que no viven en identity (criterio 5 de
 * SPEC §10): los matches los sabe matching y las estrellas learning.
 *
 * Se piden por separado y la pantalla las cruza por `empresaId` con los nombres que ya tiene.
 * El gateway no las compone a propósito: ahí solo se orquesta la exportación y la supresión de
 * datos personales, que no tienen otro lugar posible (ADR-0007); esto es una lectura y el
 * navegador ya está autenticado contra los tres servicios.
 */
export function useMatchesPorEmpresa() {
  return useQuery({
    queryKey: ['metricas', 'matches', 'globales'],
    queryFn: () => pedir<MetricasDeMatchesGlobales>('/matching/metricas/matches/globales'),
  });
}

export function useValoracionesPorEmpresa() {
  return useQuery({
    queryKey: ['metricas', 'valoraciones', 'globales'],
    queryFn: () =>
      pedir<MetricasDeValoracionesGlobales>('/learning/metricas/valoraciones/globales'),
  });
}
