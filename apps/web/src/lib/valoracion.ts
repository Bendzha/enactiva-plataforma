import type {
  EstrellasDelTaller,
  MatchPuntuado,
  MiValoracion,
  OcultarReferenciaInput,
  PuntuarMatchInput,
  ReconocimientoPersona,
  ReferenciaPublicada,
  ValorarTallerInput,
} from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

/**
 * Valoración del encuentro, referencias, tokens y puntuación del match (SPEC §3.5, ADR-0009).
 *
 * Las estrellas y las referencias viven en learning, junto al taller; la puntuación del match en
 * matching, junto al match. Son dos cosas distintas: una dice si el taller estuvo bueno y la
 * otra si el emparejamiento funcionó.
 */

const CLAVE_PENDIENTES = ['puntuaciones-pendientes'] as const;

export function useMiValoracion(tallerId: string, habilitado = true) {
  return useQuery({
    queryKey: ['mi-valoracion', tallerId],
    queryFn: () => pedir<MiValoracion | null>(`/learning/talleres/${tallerId}/mi-valoracion`),
    enabled: habilitado,
  });
}

export function useEstrellasDelTaller(tallerId: string, habilitado = true) {
  return useQuery({
    queryKey: ['estrellas', tallerId],
    queryFn: () => pedir<EstrellasDelTaller>(`/learning/talleres/${tallerId}/estrellas`),
    enabled: habilitado,
  });
}

export function useReconocimiento(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ['reconocimiento', usuarioId],
    queryFn: () => pedir<ReconocimientoPersona>(`/learning/personas/${usuarioId}/reconocimiento`),
    enabled: Boolean(usuarioId),
  });
}

export function useReferenciasDe(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ['referencias', usuarioId],
    queryFn: () => pedir<ReferenciaPublicada[]>(`/learning/personas/${usuarioId}/referencias`),
    enabled: Boolean(usuarioId),
  });
}

export function useValorarTaller(tallerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: ValorarTallerInput) =>
      pedir<MiValoracion>(`/learning/talleres/${tallerId}/valoracion`, {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mi-valoracion', tallerId] });
      void queryClient.invalidateQueries({ queryKey: ['estrellas', tallerId] });
      // El token y el promedio del facilitador cambian con esto.
      void queryClient.invalidateQueries({ queryKey: ['reconocimiento'] });
      void queryClient.invalidateQueries({ queryKey: ['referencias'] });
    },
  });
}

/** Los talleres míos que ya terminaron y todavía no puntué. */
export function usePuntuacionesPendientes(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_PENDIENTES,
    queryFn: () => pedir<string[]>('/matching/puntuaciones/pendientes'),
    enabled: habilitado,
  });
}

export function usePuntuarMatch(tallerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: PuntuarMatchInput) =>
      pedir<MatchPuntuado>(`/matching/talleres/${tallerId}/puntuacion`, {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_PENDIENTES }),
  });
}

/** Moderación de RRHH: ocultar no borra, y el motivo queda guardado (Q17). */
export function useOcultarReferencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string } & OcultarReferenciaInput) =>
      pedir<ReferenciaPublicada>(`/learning/referencias/${id}/ocultar`, {
        method: 'POST',
        body: JSON.stringify({ motivo }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referencias'] }),
  });
}

export function useMostrarReferencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<ReferenciaPublicada>(`/learning/referencias/${id}/ocultar`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['referencias'] }),
  });
}
