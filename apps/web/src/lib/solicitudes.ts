import type {
  MiSolicitud,
  PedirRolEnsenarInput,
  ProponerTallerInput,
  RechazarSolicitudInput,
  SolicitudParaRrhh,
} from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE_MIAS = ['solicitudes', 'mias'] as const;
const CLAVE_BANDEJA = ['solicitudes', 'bandeja'] as const;

export function useMisSolicitudes(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_MIAS,
    queryFn: () => pedir<MiSolicitud[]>('/identity/solicitudes/mias'),
    enabled: habilitado,
  });
}

/** La bandeja de RRHH. */
export function useSolicitudes() {
  return useQuery({
    queryKey: CLAVE_BANDEJA,
    queryFn: () => pedir<SolicitudParaRrhh[]>('/identity/solicitudes'),
  });
}

function useRefrescar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
  };
}

export function useProponerTaller() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: ProponerTallerInput) =>
      pedir<MiSolicitud>('/identity/solicitudes/propuesta-de-taller', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: refrescar,
  });
}

export function usePedirRolEnsenar() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: PedirRolEnsenarInput) =>
      pedir<MiSolicitud>('/identity/solicitudes/quiero-ensenar', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: refrescar,
  });
}

export function useAprobarSolicitud() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<MiSolicitud>(`/identity/solicitudes/${id}/aprobar`, { method: 'PATCH' }),
    onSuccess: refrescar,
  });
}

export function useRechazarSolicitud() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, ...datos }: RechazarSolicitudInput & { id: string }) =>
      pedir<MiSolicitud>(`/identity/solicitudes/${id}/rechazar`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: refrescar,
  });
}
