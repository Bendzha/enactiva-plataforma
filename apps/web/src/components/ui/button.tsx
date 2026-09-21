import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const botonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default: 'bg-marca text-white hover:bg-marca-oscuro',
        outline: 'border border-borde bg-white text-texto hover:bg-marca-suave',
        ghost: 'text-texto-suave hover:bg-marca-suave hover:text-marca',
        acento: 'bg-acento text-texto hover:brightness-95',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-6',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof botonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(botonVariants({ variant, size }), className)} {...props} />;
}
