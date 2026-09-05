'use client';

import type { ComponentType, SVGProps } from 'react';
import { AnimatedNumber } from '@/components/motion';
import { cn } from '@/lib/utils';

export type MetricIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

/**
 * Ficha de metrica. Etiqueta chica arriba, cifra grande en mono abajo.
 * El acento de color va en un filete lateral, no en un chip de icono con
 * fondo tintado -- ese patron es el que se lee como plantilla generada.
 */
export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  suffix,
  decimals = 0,
  variant = 'default'
}: {
  title: string;
  value: string | number;
  description?: string;
  icon?: MetricIcon;
  suffix?: string;
  decimals?: number;
  variant?: 'default' | 'warning' | 'success' | 'info' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-md border border-border bg-surface p-3 shadow-sm',
        variant === 'warning' && 'border-l-2 border-l-warning',
        variant === 'success' && 'border-l-2 border-l-success',
        variant === 'info' && 'border-l-2 border-l-info',
        variant === 'danger' && 'border-l-2 border-l-danger'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="label">{title}</span>
        {Icon ? <Icon className="text-muted-foreground/70" /> : null}
      </div>
      <div className="num mt-1.5 text-lg font-semibold leading-none">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} decimals={decimals} suffix={suffix} />
        ) : (
          value
        )}
      </div>
      {description ? (
        <p className="mt-1 text-2xs text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
