import type { AdminResumen, CrearAdminInput } from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE_ADMINS = ['admins'] as const;

export function useAdmins() {
  return useQuery({
    queryKey: CLAVE_ADMINS,
    queryFn: () => pedir<AdminResumen[]>('/admins'),
  });
}

export function useInvitarAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: CrearAdminInput) =>
      pedir<AdminResumen>('/admins', { method: 'POST', body: JSON.stringify(datos) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_ADMINS }),
  });
}

export function useDesactivarAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<AdminResumen>(`/admins/${id}/desactivar`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLAVE_ADMINS }),
  });
}
