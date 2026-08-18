/**
 * Cores selecionáveis para um autor seguido — valores EXATOS do design system
 * (node Figma 536:8095). Cada cor usa a mesma família em vários tons:
 *   • swatch/borda do card → borda `{cor}/6`  (selecionado: `{cor}/8`)
 *   • fundo do swatch/card → `{cor}/2 → {cor}/1` (gradiente sutil)
 *   • avatar (iniciais)    → `{cor}/9` (tom vivo)
 *   • tick/estrela         → `{cor}/11`
 *
 * As classes são LITERAIS de propósito: o Tailwind v4 só emite o que aparece
 * estático no código. Ordem espelha o Figma.
 */
export const FAVORITE_COLOR_KEYS = [
  "principal",
  "secundaria",
  "vermelho",
  "green",
  "violeta",
  "menta",
  "laranja",
  "azul",
] as const;

export type FavoriteColorKey = (typeof FAVORITE_COLOR_KEYS)[number];

interface ColorSpec {
  /** Superfície do avatar (fundo vivo + cor das iniciais). */
  tone: string;
  /** Borda do card de mensagem e do swatch (`{cor}/6`). */
  border: string;
  /** Fundo do swatch (dark, `{cor}/2`) — o card usa o gradiente. */
  swatchBg: string;
  /**
   * Fundo do card = gradiente `{cor}/2 → {cor}/1` (node 492:8120), como UTILITY do
   * Tailwind (não inline). Crucial: o Tailwind v4 só emite as CSS vars `--color-*`
   * REFERENCIADAS por utilities; um `var(--color-{cor}-1)` inline não resolveria
   * (a var não é emitida). As classes `from-/to-` forçam a emissão e montam o gradiente.
   */
  cardBg: string;
  /** Borda do swatch quando selecionado (`{cor}/8`). */
  borderActive: string;
  /** Tick do swatch selecionado / badge de estrela (`{cor}/11` e `{cor}/9`). */
  tick: string;
  star: string;
}

// text-gray-1 = escuro (sobre cores claras), text-gray-12 = claro (sobre saturadas).
const SPECS: Record<FavoriteColorKey, ColorSpec> = {
  principal: { tone: "bg-principal-9 text-gray-1", border: "border-principal-6", swatchBg: "bg-principal-2", cardBg: "bg-linear-[165deg] from-principal-2 to-principal-1", borderActive: "border-principal-8", tick: "text-principal-11", star: "text-principal-9" },
  secundaria: { tone: "bg-secundaria-9 text-gray-12", border: "border-secundaria-6", swatchBg: "bg-secundaria-2", cardBg: "bg-linear-[165deg] from-secundaria-2 to-secundaria-1", borderActive: "border-secundaria-8", tick: "text-secundaria-11", star: "text-secundaria-9" },
  vermelho: { tone: "bg-vermelho-9 text-gray-12", border: "border-vermelho-6", swatchBg: "bg-vermelho-2", cardBg: "bg-linear-[165deg] from-vermelho-2 to-vermelho-1", borderActive: "border-vermelho-8", tick: "text-vermelho-11", star: "text-vermelho-9" },
  green: { tone: "bg-green-9 text-gray-12", border: "border-green-6", swatchBg: "bg-green-2", cardBg: "bg-linear-[165deg] from-green-2 to-green-1", borderActive: "border-green-8", tick: "text-green-11", star: "text-green-9" },
  violeta: { tone: "bg-violeta-9 text-gray-12", border: "border-violeta-6", swatchBg: "bg-violeta-2", cardBg: "bg-linear-[165deg] from-violeta-2 to-violeta-1", borderActive: "border-violeta-8", tick: "text-violeta-11", star: "text-violeta-9" },
  menta: { tone: "bg-menta-9 text-gray-1", border: "border-menta-6", swatchBg: "bg-menta-2", cardBg: "bg-linear-[165deg] from-menta-2 to-menta-1", borderActive: "border-menta-8", tick: "text-menta-11", star: "text-menta-9" },
  laranja: { tone: "bg-laranja-9 text-gray-12", border: "border-laranja-6", swatchBg: "bg-laranja-2", cardBg: "bg-linear-[165deg] from-laranja-2 to-laranja-1", borderActive: "border-laranja-8", tick: "text-laranja-11", star: "text-laranja-9" },
  azul: { tone: "bg-azul-9 text-gray-12", border: "border-azul-6", swatchBg: "bg-azul-2", cardBg: "bg-linear-[165deg] from-azul-2 to-azul-1", borderActive: "border-azul-8", tick: "text-azul-11", star: "text-azul-9" },
};

/** True se `color` é uma chave de cor válida do design system. */
export function isFavoriteColor(color: string | null | undefined): color is FavoriteColorKey {
  return !!color && color in SPECS;
}

/** Superfície (fundo+texto) do avatar para uma cor; fallback neutro. */
export function toneFor(color: string | null | undefined): string {
  return isFavoriteColor(color) ? SPECS[color].tone : "bg-gray-6 text-gray-12";
}

/** Classes do swatch (fundo dark `{cor}/2` + borda `{cor}/6`). */
export function swatchFor(color: FavoriteColorKey): string {
  return `${SPECS[color].swatchBg} ${SPECS[color].border}`;
}

/** Borda do swatch selecionado (`{cor}/8`). */
export function swatchActiveFor(color: FavoriteColorKey): string {
  return SPECS[color].borderActive;
}

/** Contraste do tick no swatch selecionado (`{cor}/11`). */
export function tickFor(color: FavoriteColorKey): string {
  return SPECS[color].tick;
}

/** Classe de borda do card de mensagem para a cor; null se cor inválida. */
export function cardBorderFor(color: string | null | undefined): string | null {
  return isFavoriteColor(color) ? SPECS[color].border : null;
}

/** Cor do badge de estrela (seguindo); fallback dourado (principal). */
export function starFor(color: string | null | undefined): string {
  return isFavoriteColor(color) ? SPECS[color].star : "text-principal-9";
}

/**
 * Classes de fundo (gradiente `{cor}/2 → {cor}/1`) do card para a cor; null se
 * inválida. Utility do Tailwind (não inline) — ver nota em `ColorSpec.cardBg`.
 */
export function cardBgFor(color: string | null | undefined): string | null {
  return isFavoriteColor(color) ? SPECS[color].cardBg : null;
}
