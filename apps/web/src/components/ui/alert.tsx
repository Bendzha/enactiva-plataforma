import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Alert({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-peligro/30 bg-peligro/5 px-3 py-2 text-sm text-peligro',
        className,
      )}
      {...props}
    />
  );
}
