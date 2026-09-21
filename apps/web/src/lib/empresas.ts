import type { CrearEmpresaInput, EmpresaDetalle, EmpresaResumen } from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE_EMPRESAS = ['empresas'] as const;

export function useEmpresas() {
  return useQuery({
    queryKey: CLAVE_EMPRESAS,
    queryFn: () => pedir<EmpresaResumen[]>('/empresas'),
  });
}

export function useEmpresa(id: string | null) {
  return useQuery({
    queryKey: ['empresa', id],
    queryFn: () => pedir<EmpresaDetalle>(`/empresas/${id!}`),
    enabled: id !== null,
  });
}

/** Tras cualquier cambio se recargan el listado y la ficha: nunca se muestran datos viejos. */
function useRefrescar() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: CLAVE_EMPRESAS });
    if (id) void queryClient.invalidateQueries({ queryKey: ['empresa', id] });
  };
}

export function useCrearEmpresa() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: CrearEmpresaInput) =>
      pedir<EmpresaDetalle>('/empresas', { method: 'POST', body: JSON.stringify(datos) }),
    onSuccess: (empresa) => refrescar(empresa.id),
  });
}

export function useActivarEmpresa() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<EmpresaDetalle>(`/empresas/${id}/activar`, { method: 'PATCH' }),
    onSuccess: (empresa) => refrescar(empresa.id),
  });
}

export function useReenviarInvitacion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<EmpresaDetalle>(`/empresas/${id}/invitacion/reenviar`, { method: 'POST' }),
    onSuccess: (empresa) => refrescar(empresa.id),
  });
}
