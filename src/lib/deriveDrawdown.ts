import type { CapitalPoint } from "@/lib/api/analytics";

export interface DrawdownWindow {
  peakDate: string; // YYYY-MM-DD do topo antes da maior queda
  troughDate: string; // YYYY-MM-DD do fundo
  durationDays: number; // dias do topo ao fundo
}

/**
 * Janela do MAIOR drawdown (pico → vale) a partir da curva de capital acumulado.
 * Espelha a lógica do backend (`maxDrawdownUsd`, baseline 0) para expor as datas
 * que o tooltip mostra. Puro — deriva só de `capital.points`.
 */
export function deriveDrawdownWindow(points: CapitalPoint[]): DrawdownWindow | null {
  if (points.length === 0) return null;

  let peak = 0; // baseline 0 (igual ao cálculo do backend)
  let peakDate = points[0].date;
  let maxDd = -1;
  let ddPeakDate = points[0].date;
  let ddTroughDate = points[0].date;

  for (const p of points) {
    const cum = Number(p.cumulativePnlUsd);
    if (cum > peak) {
      peak = cum;
      peakDate = p.date;
    }
    const dd = peak - cum;
    if (dd > maxDd) {
      maxDd = dd;
      ddPeakDate = peakDate;
      ddTroughDate = p.date;
    }
  }

  const days = Math.max(
    0,
    Math.round(
      (new Date(`${ddTroughDate}T00:00:00Z`).getTime() -
        new Date(`${ddPeakDate}T00:00:00Z`).getTime()) /
        86_400_000,
    ),
  );

  return { peakDate: ddPeakDate, troughDate: ddTroughDate, durationDays: days };
}
