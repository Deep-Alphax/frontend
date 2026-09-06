/**
 * Larguras das colunas laterais do Radar.
 *
 * Antes havia um piso de 260px e um teto de 620px — números arbitrários que
 * impediam encolher ou esticar uma coluna até onde o usuário quisesse. O único
 * limite que sobrou é FÍSICO: a coluna não pode ter largura negativa nem passar
 * do espaço que existe na linha. Fora isso, qualquer largura vale — inclusive
 * `0`, que esconde a coluna, e "tudo", que engole a coluna central.
 *
 * Por que o teto continua existindo: o grid é
 * `[69px, --left-w, minmax(0,1fr), --right-w]` dentro de um container com
 * `overflow-hidden`. Se a soma das laterais passar da linha, a coluna da direita
 * (e a alça de arraste dela) sai da viewport e o usuário perde o jeito de
 * desfazer. Limitar ao espaço real mantém tudo alcançável sem tirar liberdade.
 */

/** Rail de fontes — coluna 1, largura fixa no template do grid. */
export const RAIL_W = 69;

/** Largura inicial de cada lateral (e o valor do duplo-clique na alça). */
export const COL_DEFAULT = 340;

/**
 * Espaço disponível para as três colunas redimensionáveis.
 * `0` significa "ainda não medido" — antes do primeiro layout não há como saber
 * o teto, e chutar um encolheria a coluna do usuário na primeira renderização.
 */
export function roomFor(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 0;
  return Math.max(0, containerWidth - RAIL_W);
}

/**
 * Prende a largura ao que cabe. `max <= 0` = medida desconhecida: só garante
 * que não seja negativa, deixando o valor do usuário intacto.
 */
export function clampColumn(width: number, max: number): number {
  if (!Number.isFinite(width)) return COL_DEFAULT;
  const floored = Math.max(0, width);
  return max > 0 ? Math.min(floored, max) : floored;
}

/**
 * Larguras EXIBIDAS a partir das escolhidas pelo usuário.
 *
 * O estado guarda a intenção; o clamp acontece só na exibição, então encolher a
 * janela não apaga a largura escolhida — voltando a caber, ela reaparece.
 * Quando as duas não cabem juntas, a esquerda tem prioridade e a direita fica
 * com o resto: uma regra fixa é previsível, e o usuário corrige com um arraste.
 */
export function fitPair(
  left: number,
  right: number,
  room: number,
): { left: number; right: number } {
  if (room <= 0) return { left: Math.max(0, left), right: Math.max(0, right) };
  const fittedLeft = clampColumn(left, room);
  return {
    left: fittedLeft,
    right: clampColumn(right, room - fittedLeft),
  };
}

/** Lê a largura persistida. Valor ausente/inválido cai no default. */
export function parseStoredWidth(raw: string | null): number {
  if (raw === null) return COL_DEFAULT;
  const v = Number(raw);
  // `0` é uma escolha legítima (coluna escondida), então só o inválido cai fora.
  return Number.isFinite(v) && v >= 0 ? v : COL_DEFAULT;
}
