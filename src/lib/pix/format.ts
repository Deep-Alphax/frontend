/*
 * Formatação do checkout em Pix.
 */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 29568 → "R$ 295,68" — formato que quem paga em Pix reconhece. */
export function formatBrl(cents: number): string {
  // Intl usa espaço inseparável depois de "R$"; normaliza para o comum.
  return BRL.format(cents / 100).replace(/ /g, " ");
}

/** "5.913600" → "5.9136" (exibição). */
export function formatFxRate(rate: string): string {
  const n = Number(rate);
  return Number.isFinite(n) ? n.toFixed(4) : rate;
}
