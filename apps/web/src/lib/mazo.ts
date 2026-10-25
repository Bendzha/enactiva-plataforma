import type { DecisionMazo, ResultadoDecision, TarjetaMazo } from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE_MAZO = ['mazo'] as const;

/** Las tarjetas de esta persona, ya ordenadas por afinidad. `buscar` filtra por tema. */
export function useMazo(buscar: string, habilitado = true) {
  const termino = buscar.trim();
  return useQuery({
    queryKey: [...CLAVE_MAZO, termino],
    queryFn: () =>
      pedir<TarjetaMazo[]>(
        termino ? `/matching/mazo?buscar=${encodeURIComponent(termino)}` : '/matching/mazo',
      ),
    enabled: habilitado,
  });
}

export function useDecidir() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tallerId, decision }: { tallerId: string; decision: DecisionMazo }) =>
      pedir<ResultadoDecision>(`/matching/mazo/${tallerId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      }),
    onSuccess: () => {
      // El mazo cambia con cada decisión: la tarjeta decidida ya no vuelve, y si el like
      // inscribió, el taller también cambió de estado en la otra pantalla.
      void queryClient.invalidateQueries({ queryKey: CLAVE_MAZO });
      void queryClient.invalidateQueries({ queryKey: ['talleres'] });
    },
  });
}
