import {
  derivadosDeMarca,
  type GuardarPersonalizacionInput,
  type Personalizacion,
} from '@enactiva/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { pedir } from '@/lib/api';

const CLAVE = ['mi-empresa', 'personalizacion'] as const;

/**
 * La empresa va **en la clave de la caché**.
 *
 * Sin ella, dos personas de empresas distintas que entran en el mismo navegador comparten la
 * entrada: la segunda veía la paleta de la primera hasta que la consulta se revalidara, y con
 * `staleTime: Infinity` eso no pasaba nunca. Se vio en el navegador con las dos empresas de la
 * demo.
 */
export function usePersonalizacion(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: [...CLAVE, empresaId],
    queryFn: () => pedir<Personalizacion>('/identity/mi-empresa/personalizacion'),
    enabled: Boolean(empresaId),
    // La paleta de una empresa no cambia durante una sesión salvo que RRHH la toque, y entonces
    // la mutación invalida esto. No tiene sentido volver a pedirla al cambiar de pestaña.
    staleTime: Infinity,
  });
}

function useRefrescar() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CLAVE });
}

export function useGuardarPersonalizacion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: GuardarPersonalizacionInput) =>
      pedir<Personalizacion>('/identity/mi-empresa/personalizacion', {
        method: 'PUT',
        body: JSON.stringify(datos),
      }),
    onSuccess: refrescar,
  });
}

export function useRestablecerPersonalizacion() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: () =>
      pedir<Personalizacion>('/identity/mi-empresa/personalizacion', { method: 'DELETE' }),
    onSuccess: refrescar,
  });
}

/** Las variables CSS que pinta la personalización. El resto de la paleta no se toca. */
const VARIABLES = [
  '--color-marca',
  '--color-marca-oscuro',
  '--color-marca-suave',
  '--color-acento',
  '--color-fondo',
  '--color-texto',
] as const;

/**
 * Aplica los colores de la empresa como variables CSS sobre `:root`.
 *
 * Solo corre con una sesión dentro de una empresa. El login no pasa por aquí —es anterior a la
 * sesión y nadie sabe todavía de qué empresa es quien mira— y el equipo de ENACTIVA tampoco, que
 * no pertenece a ninguna (ADR-0011).
 *
 * Al salir de la sesión se quitan las variables: si no, la siguiente persona que entrara en el
 * mismo navegador vería el login con los colores de la empresa anterior.
 */
export function useAplicarPersonalizacion(colores: Personalizacion['colores'] | undefined): void {
  useEffect(() => {
    const raiz = document.documentElement;

    if (!colores) {
      for (const variable of VARIABLES) raiz.style.removeProperty(variable);
      return;
    }

    const derivados = derivadosDeMarca(colores.marca);
    raiz.style.setProperty('--color-marca', colores.marca);
    raiz.style.setProperty('--color-marca-oscuro', derivados.oscuro);
    raiz.style.setProperty('--color-marca-suave', derivados.suave);
    raiz.style.setProperty('--color-acento', colores.acento);
    raiz.style.setProperty('--color-fondo', colores.fondo);
    raiz.style.setProperty('--color-texto', colores.texto);

    return () => {
      for (const variable of VARIABLES) raiz.style.removeProperty(variable);
    };
  }, [colores]);
}
