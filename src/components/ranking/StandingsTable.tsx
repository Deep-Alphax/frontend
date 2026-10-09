"use client";

import type { RankingRow } from "@/lib/api/ranking";
import { cn } from "@/lib/cn";
import { accuracyWidth, fmtPoints, fmtPrize } from "@/lib/ranking/rules";
import { RankTag } from "@/components/tracker/parts";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { InitialsAvatar, PositionChange } from "@/components/ranking/Podium";

/*
 * Tabela "Standings" (Figma 1464:13555). Grade em vez de <table> para as
 * colunas sumirem por breakpoint sem desalinhar: Rank some abaixo de `lg`,
 * Hit rate abaixo de `md`. Larguras do Figma: 72 · 512 · flex · 110 · 110 · 110.
 */
const GRID =
  "grid items-center gap-3 px-5 grid-cols-[56px_minmax(0,1fr)_minmax(0,90px)_minmax(0,80px)] md:grid-cols-[72px_minmax(0,1fr)_110px_110px_110px] lg:grid-cols-[72px_minmax(0,512px)_minmax(0,1fr)_110px_110px_110px]";

function HeaderRow() {
  return (
    <div role="row" className={cn(GRID, "bg-gray-2 py-3 text-base leading-[1.3] text-gray-11")}>
      <span role="columnheader">Position</span>
      <span role="columnheader">User</span>
      <span role="columnheader" className="max-lg:hidden">
        Rank
      </span>
      <span role="columnheader" className="text-right">
        Points
      </span>
      <span role="columnheader" className="text-right max-md:hidden">
        Hit rate
      </span>
      <span role="columnheader" className="text-right">
        Prize
      </span>
    </div>
  );
}

function Row({ row }: { row: RankingRow }) {
  return (
    <div role="row" className={cn(GRID, "border-t border-gray-6 py-3")}>
      <span role="cell" className="flex h-5 items-center gap-2">
        <span className="font-display text-base font-semibold leading-[1.1] tracking-[1px] text-gray-12 tabular-nums">
          {row.position}
        </span>
        <PositionChange change={row.change} size="sm" />
      </span>

      <span role="cell" className="flex min-w-0 items-center gap-3">
        <InitialsAvatar
          row={row}
          className="size-9 rounded-xl"
          textClassName="text-sm leading-[1.3]"
        />
        <span className="flex min-w-0 flex-col gap-2">
          <span className="truncate text-base font-semibold leading-[1.1] text-gray-12">
            {row.kol.name}
          </span>
          {row.kol.handle && (
            <span className="truncate text-sm leading-[1.3] text-gray-11">
              {row.kol.x ? (
                <a
                  href={`https://x.com/${row.kol.x}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-gray-12"
                >
                  @{row.kol.handle}
                </a>
              ) : (
                `@${row.kol.handle}`
              )}
            </span>
          )}
        </span>
      </span>

      <span role="cell" className="flex max-lg:hidden">
        <RankTag relevance={row.kol.relevance} size="lg" />
      </span>

      <span
        role="cell"
        className="text-right font-display text-base font-semibold leading-[1.1] tracking-[1px] text-gray-12 tabular-nums"
      >
        {fmtPoints(row.points)}
      </span>

      <span role="cell" className="flex items-center justify-end gap-2 max-md:hidden">
        <span className="relative h-1 w-11 shrink-0 overflow-clip rounded bg-gray-4">
          <span
            className="absolute inset-y-0 left-0 rounded bg-green-9"
            style={{ width: accuracyWidth(row.accuracy) }}
          />
        </span>
        <span className="text-base leading-[1.3] text-gray-12 tabular-nums">{row.accuracy}%</span>
      </span>

      <span role="cell" className="flex justify-end">
        {row.prize != null ? (
          <span className="rounded-[32px] border border-gray-6 bg-gray-3 px-3 py-2 text-base font-semibold leading-[1.1] whitespace-nowrap text-gray-12">
            {fmtPrize(row.prize)}
          </span>
        ) : (
          <span className="text-sm text-gray-11" aria-label="No prize">
            —
          </span>
        )}
      </span>
    </div>
  );
}

export function StandingsTable({
  rows,
  loading,
  empty,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  rows: RankingRow[];
  loading: boolean;
  /** Texto do estado vazio (depende de busca / temporada). */
  empty: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div
      role="table"
      aria-label="Standings"
      aria-busy={loading || undefined}
      className="w-full overflow-clip rounded-2xl border border-gray-6 bg-gray-2"
    >
      <HeaderRow />
      {loading ? (
        <SkeletonGroup label="Loading standings">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn(GRID, "border-t border-gray-6 py-3")}>
              <Skeleton className="h-4 w-8" />
              <span className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-xl" />
                <Skeleton className="h-4 w-32" />
              </span>
              <Skeleton className="h-[34px] w-24 rounded-full max-lg:hidden" />
              <Skeleton className="ml-auto h-4 w-14" />
              <Skeleton className="ml-auto h-4 w-16 max-md:hidden" />
              <Skeleton className="ml-auto h-4 w-10" />
            </div>
          ))}
        </SkeletonGroup>
      ) : rows.length === 0 ? (
        <p className="border-t border-gray-6 px-6 py-12 text-center text-sm text-gray-11">{empty}</p>
      ) : (
        <div role="rowgroup">
          {rows.map((r) => (
            <Row key={r.kol.id} row={r} />
          ))}
        </div>
      )}
      {hasMore && !loading && (
        <div className="flex justify-center border-t border-gray-6 py-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex h-11 min-w-[198px] items-center justify-center rounded-lg border border-gray-6 bg-gray-3 px-8 text-base font-semibold text-gray-12 transition-colors hover:border-gray-8 disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load 20 more"}
          </button>
        </div>
      )}
    </div>
  );
}
