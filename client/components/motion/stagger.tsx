'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/client/lib/utils';
import {
  DEFAULT_OFFSET_Y,
  DEFAULT_STAGGER,
  DURATION_REVEAL,
  EASE_OUT,
  VIEWPORT_MARGIN,
  type MotionTag
} from './motion-config';

export interface StaggerProps {
  children: ReactNode;
  /** Segundos entre la aparición de un hijo y el siguiente. */
  stagger?: number;
  /** Retraso antes del primer hijo, en segundos. */
  delay?: number;
  /** Etiqueta HTML a renderizar. */
  as?: MotionTag;
  className?: string;
}

export interface StaggerItemProps {
  children: ReactNode;
  /** Desplazamiento vertical inicial, en píxeles. */
  y?: number;
  /** Etiqueta HTML a renderizar. */
  as?: MotionTag;
  className?: string;
}

const containerVariants = (stagger: number, delay: number): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay }
  }
});

const itemVariants = (y: number): Variants => ({
  hidden: { opacity: 0, transform: `translateY(${y}px)` },
  show: {
    opacity: 1,
    transform: 'translateY(0px)',
    transition: { duration: DURATION_REVEAL, ease: EASE_OUT }
  }
});

/**
 * Contenedor que escalona la aparición de sus <StaggerItem> al entrar en viewport.
 * Solo orquesta: no anima nada propio, así que no interfiere con el layout.
 * Con 10 hijos y el escalonado por defecto el total ronda los 450ms.
 */
export function Stagger({
  children,
  stagger = DEFAULT_STAGGER,
  delay = 0,
  as = 'div',
  className
}: StaggerProps) {
  const shouldReduceMotion = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (shouldReduceMotion) {
    return <Tag className={cn(className)}>{children}</Tag>;
  }

  return (
    <Tag
      className={cn(className)}
      variants={containerVariants(stagger, delay)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: VIEWPORT_MARGIN }}
    >
      {children}
    </Tag>
  );
}

/** Hijo directo de <Stagger>. Hereda el turno que le asigna el contenedor. */
export function StaggerItem({
  children,
  y = DEFAULT_OFFSET_Y,
  as = 'div',
  className
}: StaggerItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const Tag = motion[as] as typeof motion.div;

  if (shouldReduceMotion) {
    return <Tag className={cn(className)}>{children}</Tag>;
  }

  return (
    <Tag className={cn(className)} variants={itemVariants(y)}>
      {children}
    </Tag>
  );
}
