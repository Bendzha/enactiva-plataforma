import type {
  AreaResumen,
  CrearAreaInput,
  InvitarPersonaInput,
  PersonaResumen,
  ResultadoImportacion,
  VistaPreviaImportacion,
} from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pedir } from '@/lib/api';

const CLAVE_PERSONAS = ['personas'] as const;
const CLAVE_AREAS = ['areas'] as const;

export function usePersonas() {
  return useQuery({
    queryKey: CLAVE_PERSONAS,
    queryFn: () => pedir<PersonaResumen[]>('/personas'),
  });
}

export function useAreas() {
  return useQuery({ queryKey: CLAVE_AREAS, queryFn: () => pedir<AreaResumen[]>('/areas') });
}

function useRefrescar() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: CLAVE_PERSONAS });
    void queryClient.invalidateQueries({ queryKey: CLAVE_AREAS });
  };
}

export function useInvitarPersona() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: InvitarPersonaInput) =>
      pedir<PersonaResumen>('/personas', { method: 'POST', body: JSON.stringify(datos) }),
    onSuccess: refrescar,
  });
}

export function useReenviarInvitacionPersona() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: string) =>
      pedir<PersonaResumen>(`/personas/${id}/invitacion/reenviar`, { method: 'POST' }),
    onSuccess: refrescar,
  });
}

export function useCrearArea() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: CrearAreaInput) =>
      pedir<AreaResumen>('/areas', { method: 'POST', body: JSON.stringify(datos) }),
    onSuccess: refrescar,
  });
}

/** Revisa el CSV sin escribir nada en la base. */
export function useVistaPreviaImportacion() {
  return useMutation({
    mutationFn: (contenido: string) =>
      pedir<VistaPreviaImportacion>('/personas/importar/vista-previa', {
        method: 'POST',
        body: JSON.stringify({ contenido }),
      }),
  });
}

export function useImportarPersonas() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (contenido: string) =>
      pedir<ResultadoImportacion>('/personas/importar', {
        method: 'POST',
        body: JSON.stringify({ contenido }),
      }),
    onSuccess: refrescar,
  });
}
