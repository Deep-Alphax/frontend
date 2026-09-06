/*
 * Recorte da caixa de texto na cap-height, como o Figma faz em todo o arquivo:
 * o topo da caixa passa a ser o topo das maiúsculas e a base, a baseline. Sem
 * isso o meio-leading entra na conta e as faixas do card ficam ~20% mais altas
 * que o design (uma linha de 14px mede 9px no Figma, não 15,4px).
 *
 * `text-box-trim`/`text-box-edge` são CSS moderno (Chrome/Edge 133+, Safari
 * 18.2+). Onde não houver suporte a declaração é ignorada e o layout só fica um
 * pouco mais folgado — nada quebra.
 */
export const TEXT_TRIM =
  "[text-box-trim:trim-both] [text-box-edge:cap_alphabetic]";
