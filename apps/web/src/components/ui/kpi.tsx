import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface Props {
  etiqueta: string;
  valor: ReactNode;
  /** Para valores que no son un número, como "Aún sin mediciones". */
  destacado?: boolean;
}

/**
 * Indicador del encabezado. Es un grupo con nombre accesible para que el lector de pantalla
 * anuncie "Personas activas: 18" en vez de un número suelto.
 */
export function Kpi({ etiqueta, valor, destacado = true }: Props) {
  return (
    <Card role="group" aria-label={etiqueta}>
      <p
        className={
          destacado
            ? 'text-3xl font-extrabold text-marca'
            : 'text-sm font-semibold text-texto-suave'
        }
      >
        {valor}
      </p>
      <p className="text-xs text-texto-suave">{etiqueta}</p>
    </Card>
  );
}
