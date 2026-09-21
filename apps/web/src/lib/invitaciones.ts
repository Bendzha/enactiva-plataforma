import type { EstadoInvitacion } from '@enactiva/shared';
import { useQuery } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

/** Consulta a quién pertenece el enlace de activación antes de mostrar el formulario. */
export function useEstadoInvitacion(token: string | null) {
  return useQuery({
    queryKey: ['invitacion', token],
    queryFn: () =>
      pedir<EstadoInvitacion>(`/invitaciones/estado?token=${encodeURIComponent(token!)}`),
    enabled: token !== null,
    retry: false,
  });
}
