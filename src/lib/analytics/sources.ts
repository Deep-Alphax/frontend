/**
 * Tipos da tab "Fontes" (De onde vieram os trades).
 *
 * A dimensão "Fonte" ainda NÃO é modelada no backend (dexProgram é a DEX/venue,
 * não a fonte de alpha do mock). Por ora estes tipos existem só no frontend e a
 * tab renderiza vazia — a origem/fonte e o endpoint serão definidos depois.
 * TODO(backend): expor GET de agregação por fonte (trades/winrate/capture/pnl).
 */

export type RecommendationKey =
  | "usar_mais"
  | "manter"
  | "reduzir_size"
  | "revisar_entrada"
  | "observar"
  | "cortar"
  | "aposta_curta";

export interface TradeSource {
  id: string;
  name: string;
  trades: number;
  winRatePct: number;
  /** Saída mediana (múltiplo) — null = sem dado (depende do Bloco 2). */
  medianExitMultiple: number | null;
  /** Capture: % + se ficou no alvo (`onTarget`) ou "K/o". null = sem dado. */
  capture: { pct: number; onTarget: boolean } | null;
  pnlUsd: string;
  recommendation: RecommendationKey;
}
