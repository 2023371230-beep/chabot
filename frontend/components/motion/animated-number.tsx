'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { DURATION_NUMBER, EASE_OUT } from './motion-config';

export interface AnimatedNumberProps {
  /** Valor a mostrar. Al cambiar, se interpola desde el valor actual. */
  value: number;
  /** Decimales a mostrar. Por defecto 0. */
  decimals?: number;
  /** Texto que sigue al número, p. ej. ' kg'. */
  suffix?: string;
  className?: string;
}

/**
 * Métrica numérica que interpola cuando cambia su valor.
 *
 * No anima en el primer render: el valor inicial se pinta tal cual, así que el
 * HTML del servidor y el del cliente coinciden. Reserva el ancho del valor
 * final en `ch`, de modo que ganar dígitos durante la interpolación no empuje
 * al sufijo ni al resto del layout.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix,
  className
}: AnimatedNumberProps) {
  const shouldReduceMotion = useReducedMotion();

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }),
    [decimals]
  );

  const [display, setDisplay] = useState<string>(() => formatter.format(value));
  const currentRef = useRef<number>(value);
  const isFirstRenderRef = useRef<boolean>(true);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      currentRef.current = value;
      return;
    }

    if (shouldReduceMotion) {
      currentRef.current = value;
      setDisplay(formatter.format(value));
      return;
    }

    const controls = animate(currentRef.current, value, {
      duration: DURATION_NUMBER,
      ease: EASE_OUT,
      onUpdate: (latest: number) => {
        currentRef.current = latest;
        setDisplay(formatter.format(latest));
      }
    });

    return () => {
      controls.stop();
    };
  }, [value, shouldReduceMotion, formatter]);

  const target = formatter.format(value);

  return (
    <span className={cn('tabular-nums', className)}>
      <span className="inline-block" style={{ minWidth: `${target.length}ch` }}>
        {display}
      </span>
      {suffix ? (
        // El sufijo va en su propio span: dentro del string, el espacio de una
        // mono a 34px mide ~20px y abre un hueco enorme entre cifra y unidad.
        <span className="ml-1 text-[0.6em] font-normal">{suffix.trim()}</span>
      ) : null}
    </span>
  );
}
