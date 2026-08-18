"use client";

import type { PortfolioAnalytics, PerTradePeak } from "@/lib/api/analytics";
import { NoDataBadge } from "@/components/home/dashboard/ComingSoon";
import { formatSignedUsd, formatPct } from "@/lib/format";
import { cn } from "@/lib/cn";

const REF_MULTIPLES = [20, 10, 5, 2, 1, 0.5];
const MIN_M = 0.5;
const MAX_M = 20;

/** Posição de um múltiplo no eixo (0 = base 0,5x, 1 = topo 20x) em escala log. */
function axisPos(multiple: number): number {
  const clamped = Math.min(Math.max(multiple, MIN_M), MAX_M);
  const lm = Math.log(clamped);
  return (lm - Math.log(MIN_M)) / (Math.log(MAX_M) - Math.log(MIN_M));
}

/** Múltiplo → "8,6x" / "2x" (pt-BR). */
function fmtX(m: number): string {
  return `${m.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;
}

/**
 * Uma coluna = um trade (node Figma 46:1864). Duas barras sobrepostas do baseline:
 * a translúcida sobe até o TOPO que o token atingiu; a sólida (na frente) sobe até
 * a SAÍDA. Verde quando saiu no lucro (≥1x), vermelho quando saiu abaixo de 1x.
 */
function Column({ trade }: { trade: PerTradePeak }) {
  const isLoss = trade.exitMultiple < 1;
  const peakH = axisPos(trade.peakMultiple) * 100;
  const exitH = axisPos(trade.exitMultiple) * 100;

  return (
    <div className="group relative flex h-full min-w-[8px] flex-1 items-end justify-center">
      {/* Barra translúcida: baseline → topo pós-compra */}
      <div
        className={cn(
          "w-full max-w-[22px] rounded",
          isLoss ? "bg-vermelho-5/70" : "bg-green-5/70",
        )}
        style={{ height: `${Math.max(peakH, 1)}%` }}
      />
      {/* Barra sólida (na frente): baseline → saída */}
      <div
        className={cn(
          "absolute bottom-0 w-full max-w-[22px] rounded",
          isLoss ? "bg-vermelho-10" : "bg-green-9",
        )}
        style={{ height: `${Math.max(exitH, 1)}%` }}
      />

      {/* Tooltip (node 140:2817): topo, saída, capture, PnL. */}
      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-[220px] -translate-x-1/2 rounded-lg border border-gray-6 bg-gray-3 p-3 opacity-0 shadow-xl transition-opacity group-hover:opacity-100"
      >
        <p className="text-sm font-medium text-gray-12">
          {trade.symbol ?? `${trade.mint.slice(0, 6)}…`}
        </p>
        <div className="my-2.5 h-px w-full rounded-full bg-gray-6" />
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-11">Topo depois da entrada</span>
            <span className="font-medium text-gray-12">{fmtX(trade.peakMultiple)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-11">Sua saída</span>
            <span className="font-medium text-gray-12">{fmtX(trade.exitMultiple)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-11">Capture</span>
            <span className="font-medium text-gray-12">{formatPct(trade.capturePct)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-11">PnL</span>
            <span
              className={cn(
                "font-medium",
                Number(trade.tradingPnlUsd) < 0 ? "text-danger-11" : "text-green-11",
              )}
            >
              {formatSignedUsd(trade.tradingPnlUsd)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PeakVsExitCardProps {
  peaks: PortfolioAnalytics["peaks"];
}

/**
 * "Topo × saída, trade a trade" (node Figma 46:1827). Cada coluna é um trade: a
 * barra clara vai até o pico após a compra; a sólida é onde você vendeu. Escala log
 * de múltiplos (0,5x→20x) com faixa vermelha na zona de prejuízo (<1x). Requer
 * histórico de preço — mostra "sem dado" quando não há cobertura.
 */
export function PeakVsExitCard({ peaks }: PeakVsExitCardProps) {
  // 10 trades MAIS RECENTES (por saída), exibidos do mais antigo → recente (esq→dir).
  const withData = [...peaks.perTrade.filter((p) => p.hasData)]
    .sort((a, b) => (a.exitTime < b.exitTime ? 1 : -1))
    .slice(0, 10)
    .reverse();
  const lossBandTop = axisPos(1) * 100; // topo da faixa de prejuízo (<1x)

  return (
    <section className="flex flex-col rounded-lg border border-gray-6 bg-gray-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-6 p-4">
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-gray-12">
            Topo × saída, trade a trade
          </h3>
          <p className="text-sm text-gray-11">
            Cada coluna é um trade. A barra clara vai até o topo que o token atingiu
            depois da sua compra; a barra sólida é onde você vendeu.
          </p>
        </div>
        {peaks.available ? (
          <span className="shrink-0 whitespace-nowrap text-base text-gray-11">
            {withData.length} trades mais recentes
          </span>
        ) : (
          <NoDataBadge />
        )}
      </div>

      {/* Body */}
      {peaks.available && withData.length > 0 ? (
        <div className="flex gap-3 px-4 py-7">
          {/* Eixo Y (múltiplos, log) */}
          <div className="relative h-[186px] w-8 shrink-0 text-base text-gray-11">
            {REF_MULTIPLES.map((m) => (
              <span
                key={m}
                className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
                style={{ bottom: `${axisPos(m) * 100}%` }}
              >
                {m === 0.5 ? "0,5x" : `${m}x`}
              </span>
            ))}
          </div>

          {/* Barras + grid */}
          <div className="relative h-[186px] flex-1">
            {/* Faixa da zona de prejuízo (<1x) */}
            <div
              className="absolute inset-x-0 bottom-0 rounded-sm bg-vermelho-5/15"
              style={{ height: `${lossBandTop}%` }}
            />
            {/* Grid lines nos múltiplos de referência */}
            {REF_MULTIPLES.map((m) => (
              <div
                key={m}
                className="absolute inset-x-0 h-px bg-gray-6"
                style={{ bottom: `${axisPos(m) * 100}%` }}
              />
            ))}
            {/* Colunas */}
            <div className="absolute inset-0 flex items-end gap-2">
              {withData.map((t, i) => (
                <Column key={`${t.mint}-${t.exitTime}-${i}`} trade={t} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="m-4 flex h-40 items-center justify-center rounded-md border border-dashed border-gray-6 text-center text-sm text-gray-11">
          Sem histórico de preço para os tokens deste período.
        </div>
      )}
    </section>
  );
}
