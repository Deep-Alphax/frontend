"use client";

import { useEffect, useRef } from "react";

import type {
  TrackerFeedFilters,
  TrackerFilterOptions,
} from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import { useMultiBuys, useNetFlows, useTrackerFeed } from "@/lib/tracker/useTracker";
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

/**
 * Coluna central — SocialFi Wallet Tracker (Figma 1311:52564). Rolagem
 * infinita por cursor: o sentinela no fim da lista pede a próxima página
 * quando entra na viewport (IntersectionObserver, nada de listener de scroll).
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

  const viewport = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage, isPlaceholderData } = feed;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Durante o placeholder (filtro trocando) a próxima página seria do
        // filtro ANTIGO — espera a resposta nova (lição de 28/09).
        if (entries[0]?.isIntersecting && !isFetchingNextPage && !isPlaceholderData) fetchNextPage();
      },
      { root: viewport.current, rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage]);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
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

      <ScrollArea className="min-h-0 flex-1" viewportRef={viewport} viewportClassName="max-h-full">
        {tab === "activity" &&
          (feed.isLoading ? (
            <SkeletonGroup label="Loading feed" className="flex flex-col gap-px">
              {Array.from({ length: 5 }, (_, i) => (
                <MessageSkeleton key={i} className="border-b border-gray-6 bg-gray-2 px-3 py-4" />
              ))}
            </SkeletonGroup>
          ) : items.length ? (
            <div className={cn(isPlaceholderData && "opacity-60 transition-opacity")} aria-busy={isPlaceholderData}>
              {items.map((it) => (
                <FeedCard key={it.id} item={it} />
              ))}
              <div ref={sentinel} className="h-px" />
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
    </section>
  );
}
