import type { MetricasGlobales, MetricasIntereses } from '@enactiva/shared';
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
