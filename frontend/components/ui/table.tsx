import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tabla densa. Encabezado pegajoso: al scrollear una lista larga los titulos
 * de columna se quedan a la vista, que es lo que hace usable una tabla de
 * cientos de filas.
 *
 * Densidad: fila 34px, encabezado 30px -> ~22 filas visibles en 1080px.
 */
export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn('w-full border-collapse text-sm', className)}
      {...props}
    />
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('sticky top-0 z-10 bg-surface-2 [&_th]:border-b [&_th]:border-border', className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'h-[34px] border-b border-rule transition-colors last:border-b-0 hover:bg-accent/60',
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-[30px] px-3 text-left align-middle text-2xs font-medium uppercase tracking-[0.05em] text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 align-middle', className)} {...props} />;
}
