import type {
  DeclararInteresInput,
  EditarInteresInput,
  GuardarPerfilInput,
  InteresDeclarado,
  MiPerfil,
  TemaResumen,
} from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE_PERFIL = ['mi-perfil'] as const;
const CLAVE_TEMAS = ['temas'] as const;

export function useMiPerfil(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_PERFIL,
    queryFn: () => pedir<MiPerfil>('/identity/mi-perfil'),
    enabled: habilitado,
  });
}

/** Catálogo de temas de la empresa, filtrado por lo que la persona va escribiendo. */
export function useTemas(buscar: string) {
  const termino = buscar.trim();
  return useQuery({
    queryKey: [...CLAVE_TEMAS, termino],
    queryFn: () =>
      pedir<TemaResumen[]>(
        termino ? `/identity/temas?buscar=${encodeURIComponent(termino)}` : '/identity/temas',
      ),
  });
}

function useRefrescar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: CLAVE_PERFIL });
    void queryClient.invalidateQueries({ queryKey: CLAVE_TEMAS });
  };
}

export function useGuardarPerfil() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: GuardarPerfilInput) =>
      pedir<MiPerfil>('/identity/mi-perfil', { method: 'PUT', body: JSON.stringify(datos) }),
    onSuccess: refrescar,
  });
}

export function useCrearTema() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (nombre: string) =>
      pedir<TemaResumen>('/identity/temas', { method: 'POST', body: JSON.stringify({ nombre }) }),
    onSuccess: refrescar,
  });
}

export function useDeclararInteres() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: DeclararInteresInput) =>
      pedir<InteresDeclarado>('/identity/mi-perfil/intereses', {
        method: 'POST',
        body: JSON.stringify(datos),
      }),
    onSuccess: refrescar,
  });
}

export function useEditarInteres() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, ...datos }: EditarInteresInput & { id: string }) =>
      pedir<InteresDeclarado>(`/identity/mi-perfil/intereses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(datos),
      }),
    onSuccess: refrescar,
  });
}

export function useEliminarInteres() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<void>(`/identity/mi-perfil/intereses/${id}`, { method: 'DELETE' }),
    onSuccess: refrescar,
  });
}
