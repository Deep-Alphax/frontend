"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TradeSource, RecommendationKey } from "@/lib/analytics/sources";
import { RECOMMENDATIONS, RecommendationBadge } from "@/components/home/dashboard/RecommendationBadge";
import { formatPct, formatSignedUsd, signOf } from "@/lib/format";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 15;

function SourceRow({ source }: { source: TradeSource }) {
  const tone =
    signOf(source.pnlUsd) > 0
      ? "text-green-11"
      : signOf(source.pnlUsd) < 0
        ? "text-danger-11"
        : "text-gray-12";

  return (
    <tr className="border-b border-gray-6/60 text-sm last:border-b-0">
      <td className="px-6 py-4 font-medium text-gray-12">{source.name}</td>
      <td className="px-4 py-4 text-gray-12">{source.trades}</td>
      <td className="px-4 py-4 text-gray-12">{formatPct(source.winRatePct)}</td>
      <td className="px-4 py-4 text-gray-12">
        {source.medianExitMultiple != null
          ? `${source.medianExitMultiple.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`
          : "—"}
      </td>
      <td className="px-4 py-4 text-gray-12">
        {source.capture
          ? `${source.capture.pct}% ${source.capture.onTarget ? "alvo" : "K/o"}`
          : "—"}
      </td>
      <td className={cn("px-4 py-4 font-medium", tone)}>{formatSignedUsd(source.pnlUsd)}</td>
      <td className="px-6 py-4 text-right">
        <RecommendationBadge value={source.recommendation} />
      </td>
    </tr>
  );
}

function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const arrow =
    "flex size-8 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        className={arrow}
      >
        <ChevronLeft className="size-4" />
      </button>
      {Array.from({ length: total }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "size-8 rounded-md text-sm transition-colors",
            p === page
              ? "bg-principal-9 font-semibold text-gray-1"
              : "text-gray-11 hover:bg-gray-3",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page === total}
        onClick={() => onPage(page + 1)}
        className={arrow}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

/**
 * Tab "Fontes" — tabela "De onde vieram os trades" com chips de filtro por
 * recomendação e paginação. A origem/fonte ainda não é modelada no backend, então
 * renderiza vazia por ora; passa a listar quando `sources` for populado.
 */
export function SourcesTab({ sources = [] }: { sources?: TradeSource[] }) {
  const [filters, setFilters] = useState<Set<RecommendationKey>>(new Set());
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      filters.size === 0 ? sources : sources.filter((s) => filters.has(s.recommendation)),
    [sources, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const toggle = (key: RecommendationKey) => {
    setFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(1);
  };
  const clear = () => {
    setFilters(new Set());
    setPage(1);
  };

  return (
    <section className="rounded-lg border border-gray-6 bg-gray-2">
      <div className="flex flex-col gap-4 border-b border-gray-6 p-6 xl:flex-row xl:items-center xl:justify-between">
        <h3 className="shrink-0 text-base font-semibold text-gray-12">
          De onde vieram os trades
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {RECOMMENDATIONS.map(({ key, meta }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              aria-pressed={filters.has(key)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                filters.has(key)
                  ? "border-gray-11 bg-gray-3 text-gray-12"
                  : "border-gray-6 text-gray-11 hover:text-gray-12",
              )}
            >
              {meta.label}
            </button>
          ))}
          <button
            type="button"
            onClick={clear}
            className="px-2 py-1.5 text-sm text-gray-11 transition-colors hover:text-gray-12"
          >
            Limpar filtro
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left">
          <thead>
            <tr className="border-b border-gray-6 text-sm text-gray-11">
              <th className="px-6 py-3 font-normal">Fonte</th>
              <th className="px-4 py-3 font-normal">Trades</th>
              <th className="px-4 py-3 font-normal">Winrate</th>
              <th className="px-4 py-3 font-normal">Saída mediana</th>
              <th className="px-4 py-3 font-normal">Capture</th>
              <th className="px-4 py-3 font-normal">PNL</th>
              <th className="px-6 py-3 text-right font-normal">Recomendação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center text-sm text-gray-11">
                  Sem dados de fontes ainda — a origem dos trades será conectada em breve.
                </td>
              </tr>
            ) : (
              rows.map((s) => <SourceRow key={s.id} source={s} />)
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-gray-6 p-6 text-sm text-gray-11">
        <span>
          {filtered.length} {filtered.length === 1 ? "fonte" : "fontes"}
        </span>
        {totalPages > 1 ? (
          <Pagination page={current} total={totalPages} onPage={setPage} />
        ) : null}
      </div>
    </section>
  );
}
