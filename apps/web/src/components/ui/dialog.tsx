import { useEffect, useId, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: ReactNode;
  /** 'modal' aparece centrado; 'lateral' se desliza desde la derecha (ficha de detalle). */
  variante?: 'modal' | 'lateral';
}

export function Dialog({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
  variante = 'modal',
}: DialogProps) {
  const idTitulo = useId();

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPresionar);
    return () => document.removeEventListener('keydown', alPresionar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-50 flex bg-texto/30 backdrop-blur-[1px]">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 cursor-default"
        onClick={onCerrar}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={cn(
          'relative z-10 flex max-h-full flex-col overflow-y-auto bg-white shadow-xl',
          variante === 'modal'
            ? 'm-auto w-full max-w-md rounded-xl p-6'
            : 'ml-auto h-full w-full max-w-md p-6',
        )}
      >
        <div className="mb-4">
          <h2 id={idTitulo} className="text-lg font-bold">
            {titulo}
          </h2>
          {descripcion && <p className="mt-1 text-sm text-texto-suave">{descripcion}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
