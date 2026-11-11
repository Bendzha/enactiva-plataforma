import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        activa: 'bg-marca-suave text-marca',
        // Con el color de cada empresa, un marrón fijo podía quedar ilegible sobre su acento.
        pendiente: 'bg-acento/20 text-texto',
        neutro: 'bg-fondo text-texto-suave',
      },
    },
    defaultVariants: { variant: 'neutro' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
