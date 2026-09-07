import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/client/lib/utils';

/**
 * Etiqueta de estado. Relleno tenue + texto del mismo tono: legible sin gritar
 * dentro de una tabla densa. El color nunca es la unica senal, la palabra va
 * escrita dentro.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold leading-none',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-muted-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        solid: 'bg-foreground text-background'
      }
    },
    defaultVariants: { variant: 'default' }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
