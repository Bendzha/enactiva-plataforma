import type { AceptarDocumentosInput, EstadoAceptaciones } from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE = ['mis-aceptaciones'] as const;

export function useMisAceptaciones(habilitado: boolean) {
  return useQuery({
    queryKey: CLAVE,
    queryFn: () => pedir<EstadoAceptaciones>('/identity/mis-aceptaciones'),
    enabled: habilitado,
  });
}

export function useAceptarDocumentos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: AceptarDocumentosInput) =>
      pedir<EstadoAceptaciones>('/identity/mis-aceptaciones', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: (estado) => {
      // El servidor devuelve el estado ya actualizado, así que se usa directo; igual se
      // invalida para que la próxima lectura venga de él y no de esta copia.
      queryClient.setQueryData(CLAVE, estado);
      void queryClient.invalidateQueries({ queryKey: CLAVE });
    },
  });
}
