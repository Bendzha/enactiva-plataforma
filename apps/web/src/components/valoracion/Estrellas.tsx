import { ESTRELLAS_MAXIMAS } from '@enactiva/shared';
import { cn } from '@/lib/utils';

interface EstrellasProps {
  /** De 1 a 5. Admite decimales para mostrar un promedio. */
  valor: number;
  /** Si se omite, las estrellas solo se muestran. */
  onCambiar?: (valor: number) => void;
  etiqueta?: string;
  size?: 'sm' | 'default';
}

/**
 * Las estrellas del ejemplo que mandó la clienta, tal cual: ⭐⭐⭐⭐.
 *
 * Cuando se puede elegir son botones de verdad y no iconos clicables, para que se llegue con el
 * teclado: valorar es la única acción que el participante hace después del taller.
 */
export function Estrellas({ valor, onCambiar, etiqueta, size = 'default' }: EstrellasProps) {
  const clase = size === 'sm' ? 'text-base' : 'text-xl';
  const posiciones = Array.from({ length: ESTRELLAS_MAXIMAS }, (_, indice) => indice + 1);

  if (!onCambiar) {
    return (
      <span className={cn('tracking-tight', clase)} aria-label={`${valor} de ${ESTRELLAS_MAXIMAS}`}>
        {posiciones.map((posicion) => (
          <span key={posicion} className={posicion <= Math.round(valor) ? '' : 'opacity-25'}>
            ⭐
          </span>
        ))}
      </span>
    );
  }

  return (
    <span role="radiogroup" aria-label={etiqueta} className="inline-flex gap-0.5">
      {posiciones.map((posicion) => (
        <button
          key={posicion}
          type="button"
          role="radio"
          aria-checked={posicion === valor}
          aria-label={`${posicion} de ${ESTRELLAS_MAXIMAS}`}
          onClick={() => onCambiar(posicion)}
          className={cn(
            'rounded transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca',
            clase,
            posicion <= valor ? '' : 'opacity-25 hover:opacity-60',
          )}
        >
          ⭐
        </button>
      ))}
    </span>
  );
}
