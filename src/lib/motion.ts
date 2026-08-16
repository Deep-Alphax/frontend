/**
 * Tokens de motion do Design System (espelho de `globals.css` para uso em JS,
 * ex.: framer-motion, que não lê `var(--duration-*)`). Manter em sincronia com
 * o `@theme`. Durações em SEGUNDOS (unidade do framer); curvas como arrays de
 * cubic-bezier `[x1, y1, x2, y2]`.
 */

/** Durações (s). instant→ambient conforme o DS. */
export const DURATION = {
  instant: 0.08,
  quick: 0.14,
  base: 0.2,
  emphasis: 0.32,
  entrance: 0.42,
  ambient: 1.2,
} as const;

/** Curvas de easing (cubic-bezier). */
export const EASE = {
  /** Padrão — entra e sai em tela. */
  standard: [0.2, 0, 0, 1],
  /** Entrada com desaceleração na chegada. */
  out: [0.16, 1, 0.3, 1],
  /** Saída com aceleração ao partir. */
  in: [0.7, 0, 0.84, 0],
} as const;

/** Atrasos de cascata (s) para stagger de listas/grades. */
export const STAGGER = {
  tight: 0.025,
  base: 0.04,
  loose: 0.06,
} as const;
