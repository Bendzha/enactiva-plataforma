import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-md border border-borde bg-white px-3 text-sm text-texto placeholder:text-texto-suave/70',
        'focus-visible:border-marca focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-marca',
        'aria-[invalid=true]:border-peligro',
        className,
      )}
      {...props}
    />
  );
}
