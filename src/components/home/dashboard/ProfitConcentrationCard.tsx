import type { PortfolioAnalytics } from "@/lib/api/analytics";
import { formatUsd, formatPct } from "@/lib/format";
import { cn } from "@/lib/cn";

interface ProfitConcentrationCardProps {
  concentration: PortfolioAnalytics["profitConcentration"];
}

/**
 * "Concentração do lucro" (Figma 53:2873) — barra segmentada (top 3 / 4–10 / resto,
 * % do lucro bruto) + linhas de ponta a ponta com swatch, rótulo/sub e valor.
 * Dados reais do backend.
 */
export function ProfitConcentrationCard({
  concentration,
}: ProfitConcentrationCardProps) {
  const { top3, next7, rest, closedTrades } = concentration;

  const segments = [
    { key: "top3", pct: top3.pct, bar: "bg-green-10", text: "text-gray-1" },
    { key: "next7", pct: next7.pct, bar: "bg-blue-10", text: "text-gray-1" },
    { key: "rest", pct: rest.pct, bar: "bg-gray-6", text: "text-gray-12" },
  ];

  const legend = [
    {
      dot: "bg-green-10",
      title: "Melhores 3 tokens",
      sub: `${top3.count} de ${closedTrades} tokens`,
      usd: top3.pnlUsd,
    },
    {
      dot: "bg-blue-10",
      title: "Tokens 4 a 10",
      sub: `${next7.count} ${next7.count === 1 ? "token" : "tokens"}`,
      usd: next7.pnlUsd,
    },
    {
      dot: "bg-gray-6",
      title: "Todo o resto",
      sub: `${rest.count} ${rest.count === 1 ? "token" : "tokens"}`,
      usd: rest.pnlUsd,
    },
  ];

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2">
      <div className="flex items-center justify-between border-b border-gray-6 p-4">
        <h3 className="text-lg font-semibold text-gray-12">Concentração do lucro</h3>
        <span className="text-base text-gray-11">100% do lucro bruto</span>
      </div>

      {/* Barra segmentada (min-width garante o % legível em fatias pequenas). */}
      <div className="flex items-center gap-1 border-b border-gray-6 p-4">
        {segments.map((s) => (
          <div
            key={s.key}
            className={cn(
              "flex min-w-[56px] items-center justify-center rounded-lg py-3 text-base font-semibold",
              s.bar,
              s.text,
            )}
            style={{ flexGrow: Math.max(s.pct, 6), flexBasis: 0 }}
          >
            {formatPct(s.pct)}
          </div>
        ))}
      </div>

      <ul>
        {legend.map((item) => (
          <li
            key={item.title}
            className="flex items-center justify-between border-b border-gray-6 p-4 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <span className={cn("size-4 shrink-0 rounded", item.dot)} />
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-gray-12">{item.title}</p>
                <p className="text-sm text-gray-11">{item.sub}</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-gray-12">{formatUsd(item.usd)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
