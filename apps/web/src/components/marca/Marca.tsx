import { cn } from '@/lib/utils';

/**
 * El nombre del producto, en un solo lugar.
 *
 * Pasó a ser «ENACTIVA Match» en toda la aplicación el 2026-10-29. Vive acá y no repetido en
 * cada pantalla para que el próximo cambio de nombre sea una línea.
 */
export function Marca({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-extrabold tracking-tight text-marca',
        className,
      )}
    >
      <span className="size-2.5 rounded-full bg-acento" aria-hidden="true" />
      ENACTIVA Match
    </span>
  );
}
