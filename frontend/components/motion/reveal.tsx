'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_OFFSET_Y,
  DURATION_REVEAL,
  EASE_OUT,
  VIEWPORT_MARGIN,
  type MotionTag
} from './motion-config';

export interface RevealProps {
  children: ReactNode;
  /** Retraso antes de revelar, en segundos. */
  delay?: number;
  /** Desplazamiento vertical inicial, en píxeles. */
  y?: number;
  /** Etiqueta HTML a renderizar. */
  as?: MotionTag;
  className?: string;
}

/**
 * Revela a sus hijos cuando entran en el viewport: fade + desplazamiento corto.
 * Se anima una sola vez. `transform` no afecta al layout, así que no hay CLS.
 */
export function Reveal({
  children,
  delay = 0,
  y = DEFAULT_OFFSET_Y,
  as = 'div',
  className
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion();
  // El proxy `motion` está tipado por etiqueta; todas las etiquetas HTML
  // comparten la misma superficie de props, así que fijamos una para el JSX.
  const Tag = motion[as] as typeof motion.div;

  if (shouldReduceMotion) {
    return <Tag className={cn(className)}>{children}</Tag>;
  }

  return (
    <Tag
      className={cn(className)}
      initial={{ opacity: 0, transform: `translateY(${y}px)` }}
      whileInView={{ opacity: 1, transform: 'translateY(0px)' }}
      viewport={{ once: true, margin: VIEWPORT_MARGIN }}
      transition={{ duration: DURATION_REVEAL, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}
