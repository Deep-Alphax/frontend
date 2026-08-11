"use client";

import type { PortfolioAnalytics, PerTradePeak } from "@/lib/api/analytics";
import { NoDataBadge } from "@/components/home/dashboard/ComingSoon";
import { formatSignedUsd, formatPct } from "@/lib/format";
import { cn } from "@/lib/cn";

const REF_MULTIPLES = [20, 10, 5, 2, 1, 0.5];
const MIN_M = 0.5;
const MAX_M = 20;

/** Posição de um múltiplo no eixo (0 = base, 1 = topo) em escala logarítmica. */
function axisPos(multiple: number): number {
  const clamped = Math.min(Math.max(multiple, MIN_M), MAX_M);
  const lm = Math.log(clamped);
  return (lm - Math.log(MIN_M)) / (Math.log(MAX_M) - Math.log(MIN_M));
}

function Column({ trade }: { trade: PerTradePeak }) {
  const isLoss = trade.exitMultiple < 1;
  const peakPos = axisPos(trade.peakMultiple);
  const basePos = axisPos(1);
  const exitPos = axisPos(trade.exitMultiple);

  const barBottom = Math.min(basePos, peakPos) * 100;
  const barHeight = Math.abs(peakPos - basePos) * 100;

  const title = `${trade.symbol ?? trade.mint.slice(0, 6)} · topo ${trade.peakMultiple}x · saída ${trade.exitMultiple}x · captura ${formatPct(trade.capturePct)} · ${formatSignedUsd(trade.tradingPnlUsd)}`;

  return (
    <div className="relative h-full min-w-[10px] flex-1" title={title}>
      {/* Barra cinza: entrada → topo pós-compra */}
      <div
        className={cn(
          "absolute left-1/2 w-2 -translate-x-1/2 rounded-full",
          isLoss ? "bg-danger-10/40" : "bg-gray-6",
        )}
        style={{ bottom: `${barBottom}%`, height: `${Math.max(barHeight, 2)}%` }}
      />
      {/* Marcador âmbar: onde você vendeu (vermelho se prejuízo) */}
      <div
        className={cn(
          "absolute left-1/2 h-1.5 w-3 -translate-x-1/2 rounded-full",
          isLoss ? "bg-danger-10" : "bg-principal-9",
        )}
        style={{ bottom: `calc(${exitPos * 100}% - 3px)` }}
      />
    </div>
  );
}

interface PeakVsExitCardProps {
  peaks: PortfolioAnalytics["peaks"];
}

/**
 * "Topo × saída, trade a trade" (Bloco 2). Cada coluna é um trade: a barra vai
 * até o pico após a compra; o marcador âmbar é onde você vendeu. Requer histórico
 * de preço — mostra "sem dado" quando não há cobertura.
 */
export function PeakVsExitCard({ peaks }: PeakVsExitCardProps) {
  const withData = peaks.perTrade.filter((p) => p.hasData);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-gray-6 bg-gray-2 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-12">
            Topo × saída, trade a trade
          </h3>
          <p className="mt-1 text-sm text-gray-11">
            A barra vai até o topo da sua compra; o ponto âmbar é onde você vendeu.
          </p>
        </div>
        {peaks.available ? (
          <span className="text-sm text-gray-11">
            {withData.length} trades · {formatPct(peaks.coveragePct)} com dado
          </span>
        ) : (
          <NoDataBadge />
        )}
      </div>

      {peaks.available && withData.length > 0 ? (
        <div className="mt-4 flex gap-4">
          {/* Eixo Y (múltiplos) */}
          <div className="relative h-56 w-8 shrink-0 text-xs text-gray-11">
            {REF_MULTIPLES.map((m) => (
              <span
                key={m}
                className="absolute right-0 -translate-y-1/2"
                style={{ bottom: `${axisPos(m) * 100}%` }}
              >
                {m}x
              </span>
            ))}
          </div>
          {/* Colunas */}
          <div className="relative flex h-56 flex-1 items-stretch gap-1.5">
            {/* Linha de referência da entrada (1x) */}
            <div
              className="absolute inset-x-0 border-t border-dashed border-gray-6"
              style={{ bottom: `${axisPos(1) * 100}%` }}
            />
            {withData.map((t, i) => (
              <Column key={`${t.mint}-${t.exitTime}-${i}`} trade={t} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex h-40 items-center justify-center rounded-md border border-dashed border-gray-6 text-center text-sm text-gray-11">
          Sem histórico de preço para os tokens deste período.
        </div>
      )}
    </section>
  );
}
