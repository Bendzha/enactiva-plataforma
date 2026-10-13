import type {
  CrearTallerInput,
  EditarTallerInput,
  FranjaDisponibilidad,
  GuardarDisponibilidadInput,
  TallerResumen,
} from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE_TALLERES = ['talleres'] as const;
const CLAVE_MIOS = ['talleres', 'mios'] as const;
const CLAVE_DISPONIBILIDAD = ['disponibilidad'] as const;

/** Los talleres de mi empresa que todavía no ocurren. */
export function useTalleres(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_TALLERES,
    queryFn: () => pedir<TallerResumen[]>('/learning/talleres'),
    enabled: habilitado,
  });
}

/** Los que dicto yo, incluidos los que ya pasaron. */
export function useMisTalleres(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_MIOS,
    queryFn: () => pedir<TallerResumen[]>('/learning/talleres/mios'),
    enabled: habilitado,
  });
}

function useRefrescar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: CLAVE_TALLERES });
  };
}

export function usePublicarTaller() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: CrearTallerInput) =>
      pedir<TallerResumen>('/learning/talleres', { method: 'POST', body: JSON.stringify(datos) }),
    onSuccess: refrescar,
  });
}

export function useEditarTaller() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, ...datos }: EditarTallerInput & { id: string }) =>
      pedir<TallerResumen>(`/learning/talleres/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: refrescar,
  });
}

export function useInscribirse() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<TallerResumen>(`/learning/talleres/${id}/inscripcion`, { method: 'POST' }),
    onSuccess: refrescar,
  });
}

export function useCancelarInscripcion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<TallerResumen>(`/learning/talleres/${id}/inscripcion`, { method: 'DELETE' }),
    onSuccess: refrescar,
  });
}

export function useMiDisponibilidad(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_DISPONIBILIDAD,
    queryFn: () => pedir<FranjaDisponibilidad[]>('/learning/disponibilidad'),
    enabled: habilitado,
  });
}

export function useGuardarDisponibilidad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: GuardarDisponibilidadInput) =>
      pedir<FranjaDisponibilidad[]>('/learning/disponibilidad', {
        method: 'PUT',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_DISPONIBILIDAD });
    },
  });
}
