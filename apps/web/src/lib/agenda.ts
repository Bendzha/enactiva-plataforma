import type { Agenda } from '@enactiva/shared';
import { useQuery } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

/** Lo que esta persona tiene por delante: lo que dicta y a lo que va. */
export function useAgenda(habilitado = true) {
  return useQuery({
    queryKey: ['agenda'],
    queryFn: () => pedir<Agenda>('/learning/agenda'),
    enabled: habilitado,
  });
}
