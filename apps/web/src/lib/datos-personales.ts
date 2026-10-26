import type { ResultadoSupresion } from '@enactiva/shared';
import { useMutation } from '@tanstack/react-query';
import { descargar, pedir } from '@/lib/api';

/**
 * Los dos derechos que la plataforma resuelve sola (Ley 21.719, SPEC §3.7): llevarse sus datos
 * y borrar su cuenta. Las dos rutas las compone el gateway, porque los datos de una persona
 * viven repartidos en tres bases (ADR-0007).
 */

/** Entrega el archivo al navegador, que es lo único que falta después de pedirlo. */
function guardarEnElDisco(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  // Sin esto el archivo queda retenido en memoria mientras la pestaña siga abierta.
  URL.revokeObjectURL(url);
}

export function useDescargarMisDatos() {
  return useMutation({
    mutationFn: async () => {
      const { blob, nombre } = await descargar('/datos/exportar');
      guardarEnElDisco(blob, nombre);
    },
  });
}

export function useSuprimirCuenta() {
  return useMutation({
    mutationFn: () => pedir<ResultadoSupresion>('/datos/suprimir', { method: 'DELETE' }),
  });
}
