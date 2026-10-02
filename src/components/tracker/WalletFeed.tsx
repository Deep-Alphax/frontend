"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUp } from "lucide-react";

import type {
  TrackerFeedFilters,
  TrackerFilterOptions,
} from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import {
  refreshFeedTop,
  useFeedRealtime,
  useMultiBuys,
  useNetFlows,
  useTrackerFeed,
} from "@/lib/tracker/useTracker";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { MessageSkeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { FeedCard } from "@/components/tracker/FeedCard";
import {
  EventFilter,
  NetworkFilter,
  QuickBuyMenu,
  ValueFilter,
  WalletsFilter,
} from "@/components/tracker/FeedFilters";
import { MultiBuysList, NetFlowsList } from "@/components/tracker/FlowLists";
import { EmptyState, LiveChip, Segmented } from "@/components/tracker/parts";

export type FeedTab = "activity" | "multi" | "flows";

const TABS: Array<{ value: FeedTab; label: string }> = [
  { value: "activity", label: "Activity" },
  { value: "multi", label: "Multi Buys" },
  { value: "flows", label: "Net Flows" },
];

const hasFilters = (f: TrackerFeedFilters) =>
  !!(f.chain || (f.event && f.event !== "all") || f.minUsd || f.kols?.length || f.source);

/** Altura típica de um card antes de medir (o real é medido pelo virtualizer). */
const CARD_ESTIMATE_PX = 150;
/** Até aqui do topo conta como "lendo o topo": atualização entra direto. */
const TOP_ZONE_PX = 120;

/**
 * Coluna central — SocialFi Wallet Tracker (Figma 1311:52564).
 *
 * Fluidez (o feed recebe trades de ~450 carteiras):
 *  - lista VIRTUALIZADA: só os cards visíveis (+ folga) existem no DOM;
 *  - tempo real recarrega só a 1ª página (`refreshFeedTop`), no máx. a cada
 *    3s, e só se o usuário estiver no topo. Lendo mais abaixo, a lista não
 *    se mexe: aparece "New activity" e ele decide quando subir;
 *  - cards memoizados: o que não mudou não re-renderiza.
 * Rolagem infinita por cursor: a próxima página vem quando o fim da lista
 * virtual se aproxima.
 */
export function WalletFeed({
  filters,
  onFilters,
  options,
  tab,
  onTab,
  enabled,
  className,
}: {
  filters: TrackerFeedFilters;
  onFilters: (f: TrackerFeedFilters) => void;
  options: TrackerFilterOptions | undefined;
  tab: FeedTab;
  onTab: (t: FeedTab) => void;
  enabled: boolean;
  className?: string;
}) {
  const feed = useTrackerFeed(filters, enabled && tab === "activity");
  const multi = useMultiBuys(enabled && tab === "multi");
  const flows = useNetFlows(enabled && tab === "flows");

  const qc = useQueryClient();
  const viewport = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isPlaceholderData } = feed;
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  // ── Tempo real sem sacudir a lista ──
  const [pending, setPending] = useState(0);
  const atTop = () => (viewport.current?.scrollTop ?? 0) < TOP_ZONE_PX;
  const onRealtime = useCallback(() => {
    if (tab !== "activity") return;
    if (atTop()) refreshFeedTop(qc, filters);
    else setPending((n) => n + 1);
  }, [qc, filters, tab]);
  useFeedRealtime(enabled, onRealtime);
  const showNew = () => {
    viewport.current?.scrollTo({ top: 0, behavior: "smooth" });
    refreshFeedTop(qc, filters);
    setPending(0);
  };
  // Filtro trocado: avisos pendentes eram do recorte antigo.
  useEffect(() => setPending(0), [filters]);

  // ── Lista virtual ──
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewport.current,
    estimateSize: () => CARD_ESTIMATE_PX,
    getItemKey: (i) => items[i].id,
    overscan: 6,
    // Antes da 1ª medição (e no jsdom) renderiza como uma coluna de altura típica.
    initialRect: { width: 0, height: 900 },
  });
  const virtualItems = virtualizer.getVirtualItems();
  const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? -1;
  useEffect(() => {
    // Durante o placeholder (filtro trocando) a próxima página seria do
    // filtro ANTIGO — espera a resposta nova (lição de 28/09).
    if (lastVisible >= items.length - 4 && hasNextPage && !isFetchingNextPage && !isPlaceholderData) {
      void fetchNextPage();
    }
  }, [lastVisible, items.length, hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage]);
  const set = (patch: Partial<TrackerFeedFilters>) => onFilters({ ...filters, ...patch });

  return (
    <section
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-1", className)}
    >
      <header className="flex shrink-0 flex-col gap-2.5 border-b border-gray-6 bg-gray-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold leading-[1.3] text-gray-12">SocialFi Wallet Tracker</h2>
            <LiveChip />
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <QuickBuyMenu />
            <Segmented label="Feed view" options={TABS} value={tab} onChange={onTab} />
          </div>
        </div>
        {tab === "activity" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <WalletsFilter options={options} selected={filters.kols ?? []} onChange={(kols) => set({ kols })} />
              <NetworkFilter value={filters.chain} onChange={(chain) => set({ chain })} />
              <EventFilter value={filters.event ?? "all"} onChange={(event) => set({ event })} />
              <ValueFilter value={filters.minUsd ?? 0} onChange={(minUsd) => set({ minUsd })} />
            </div>
            <button
              type="button"
              onClick={() => onFilters({})}
              disabled={!hasFilters(filters)}
              className="text-xs font-medium leading-[1.3] text-gray-11 transition-colors hover:text-gray-12 disabled:cursor-default disabled:hover:text-gray-11"
            >
              Clear filter
            </button>
          </div>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
      {pending > 0 && tab === "activity" && (
        <button
          type="button"
          onClick={showNew}
          className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-principal-11 px-3 py-1.5 text-xs font-semibold text-gray-1 shadow-lg transition-colors hover:bg-principal-10"
        >
          <ArrowUp className="size-3.5" aria-hidden />
          New activity
        </button>
      )}
      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={viewport}
        viewportClassName="max-h-full"
        viewportProps={{
          onScroll: () => {
            // Voltou ao topo com avisos pendentes: aplica sem pedir clique.
            if (pending > 0 && atTop()) {
              refreshFeedTop(qc, filters);
              setPending(0);
            }
          },
        }}
      >
        {tab === "activity" &&
          (feed.isLoading ? (
            <SkeletonGroup label="Loading feed" className="flex flex-col gap-px">
              {Array.from({ length: 5 }, (_, i) => (
                <MessageSkeleton key={i} className="border-b border-gray-6 bg-gray-2 px-3 py-4" />
              ))}
            </SkeletonGroup>
          ) : items.length ? (
            <div className={cn(isPlaceholderData && "opacity-60 transition-opacity")} aria-busy={isPlaceholderData}>
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {virtualItems.map((v) => (
                  <div
                    key={v.key}
                    data-index={v.index}
                    ref={virtualizer.measureElement}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${v.start}px)` }}
                  >
                    <FeedCard item={items[v.index]} />
                  </div>
                ))}
              </div>
              {isFetchingNextPage && (
                <SkeletonGroup label="Loading more">
                  <MessageSkeleton className="border-b border-gray-6 bg-gray-2 px-3 py-4" />
                </SkeletonGroup>
              )}
            </div>
          ) : (
            <EmptyState>
              {hasFilters(filters)
                ? "No activity matches these filters."
                : "No KOL activity yet. Trades and calls show up here in real time."}
            </EmptyState>
          ))}
        {tab === "multi" &&
          (multi.isLoading ? (
            <SkeletonGroup label="Loading multi buys">
              <MessageSkeleton className="px-3 py-4" />
            </SkeletonGroup>
          ) : (
            <MultiBuysList items={multi.data ?? []} />
          ))}
        {tab === "flows" &&
          (flows.isLoading ? (
            <SkeletonGroup label="Loading net flows">
              <MessageSkeleton className="px-3 py-4" />
            </SkeletonGroup>
          ) : (
            <NetFlowsList items={flows.data ?? []} />
          ))}
      </ScrollArea>
      </div>
    </section>
  );
}
