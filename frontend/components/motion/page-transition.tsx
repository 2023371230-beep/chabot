'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DURATION_PAGE, EASE_OUT, type MotionTag } from './motion-config';

export interface PageTransitionProps {
  children: ReactNode;
  /** Desplazamiento vertical inicial, en píxeles. */
  y?: number;
  /** Etiqueta HTML a renderizar. */
  as?: MotionTag;
  className?: string;
}

/**
 * Envuelve el contenido de una página: fade + desplazamiento corto al montar.
 * Sin animación de salida: en el App Router la ruta anterior ya se desmontó.
 */
export function PageTransition({
  children,
  y = 8,
  as = 'div',
  className
}: PageTransitionProps) {
  const shouldReduceMotion = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (shouldReduceMotion) {
    return <Tag className={cn(className)}>{children}</Tag>;
  }

  return (
    <Tag
      className={cn(className)}
      initial={{ opacity: 0, transform: `translateY(${y}px)` }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      transition={{ duration: DURATION_PAGE, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}
