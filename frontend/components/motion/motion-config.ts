/**
 * Constantes compartidas de movimiento del dashboard.
 * Dashboard operativo: la animación acompaña, no entretiene.
 * Todo por debajo de ~400ms, easing ease-out fuerte, sin rebotes.
 */

/** Curva ease-out fuerte: arranca rápido y aterriza suave. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Duración de una revelación al entrar en viewport. */
export const DURATION_REVEAL = 0.36;

/** Duración de la transición de página al montar. */
export const DURATION_PAGE = 0.28;

/** Duración de la interpolación numérica de las métricas. */
export const DURATION_NUMBER = 0.4;

/** Desplazamiento vertical inicial por defecto, en píxeles. */
export const DEFAULT_OFFSET_Y = 12;

/** Escalonado entre hijos de un <Stagger>, en segundos. */
export const DEFAULT_STAGGER = 0.05;

/** Margen del viewport: dispara un poco antes de que el elemento toque el borde. */
export const VIEWPORT_MARGIN = '-10% 0px';

/** Etiquetas HTML admitidas por el prop `as` de las primitivas. */
export type MotionTag =
  | 'div'
  | 'section'
  | 'article'
  | 'header'
  | 'footer'
  | 'aside'
  | 'ul'
  | 'ol'
  | 'li'
  | 'span'
  | 'p';
