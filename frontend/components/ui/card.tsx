import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Panel. Superficie elevada un paso sobre el fondo, filete de 1px y sombra
 * apenas perceptible. `flex flex-col` de fabrica para que un panel pueda
 * contener una region con scroll propio.
 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-md border border-border bg-surface text-card-foreground shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center justify-between gap-3 border-b border-rule px-3',
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[13px] font-semibold', className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 p-3', className)} {...props} />;
}
