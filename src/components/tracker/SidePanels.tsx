"use client";

import { memo } from "react";

import type { DiscoveryItem, SourcePeriod, TopSourceItem } from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import { compactUsd, initials, shortAddress, tokenLabel } from "@/lib/tracker/format";
import { useFollowWallet } from "@/lib/tracker/useTracker";
import { hashStr } from "@/lib/walletReader/types";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState, Panel, Segmented, TokenIcon } from "@/components/tracker/parts";

// ─────────────────────────────── Top sources ───────────────────────────────

const PERIODS: Array<{ value: SourcePeriod; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "15d", label: "15D" },
];

/** Avatar do grupo (quadrado arredondado) — cor determinística pelo nome. */
const GROUP_SKINS = [
  "bg-vermelho-9 text-gray-12",
  "bg-secundaria-11 text-gray-1",
  "bg-gray-12 text-gray-1",
  "bg-violeta-9 text-gray-12",
  "bg-laranja-11 text-gray-1",
  "bg-menta-9 text-gray-1",
];

/** Acerto: Alto ≥50% verde · Médio 30–49% âmbar · Baixo <30% vermelho (Figma). */
function rateTone(rate: number): { bar: string; text: string } {
  if (rate >= 0.5) return { bar: "bg-green-11", text: "text-green-11" };
  if (rate >= 0.3) return { bar: "bg-principal-11", text: "text-principal-11" };
  return { bar: "bg-vermelho-11", text: "text-vermelho-11" };
}

export const sourceKey = (s: Pick<TopSourceItem, "platform" | "group">) => `${s.platform}:${s.group}`;

function SourceRow({
  item,
  rank,
  active,
  onToggle,
}: {
  item: TopSourceItem;
  rank: number;
  active: boolean;
  onToggle: () => void;
}) {
  const tone = active ? { bar: "bg-principal-11", text: "text-principal-11" } : rateTone(item.hitRate);
  const skin = GROUP_SKINS[hashStr(item.group) % GROUP_SKINS.length];
  // Selos do Figma só existem para Telegram e Discord; pump.fun/FOMO sem selo.
  const badge =
    item.platform === "TELEGRAM"
      ? active
        ? "/tracker/platform-telegram-active.svg"
        : "/tracker/platform-telegram-card.svg"
      : item.platform === "DISCORD"
        ? "/tracker/platform-discord.svg"
        : null;
  return (
    <li
      className={cn(
        "relative flex items-center gap-2.5 border-b border-gray-6 px-3 py-2",
        active && "bg-principal-2",
      )}
    >
      {active && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-principal-11" />}
      <span
        className={cn(
          "w-2 shrink-0 text-center text-xs font-semibold leading-[1.3]",
          active ? "text-principal-10" : "text-gray-11",
        )}
      >
        {rank}
      </span>
      <span className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-[8.533px] text-[13.867px] font-bold", skin)}>
        {item.group.replace(/[^A-Za-z0-9]/g, "").charAt(0).toUpperCase() || "?"}
        {badge && (
          <span className="absolute left-[20.27px] top-[20.27px] size-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- selo SVG do Figma */}
            <img src={badge} alt="" className="absolute -inset-[13.33%] block size-[126.66%] max-w-none" />
          </span>
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="truncate text-xs font-semibold leading-[1.3] text-gray-12">{item.group}</p>
        <p className="truncate text-[11px] leading-[1.3] text-gray-11">
          {item.best ? `best ${item.best.symbol ? `$${item.best.symbol}` : "call"} ${item.best.multiple.toFixed(1)}x` : "no standout call"}
        </p>
        <div className="flex items-center gap-2">
          <span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-[3px] bg-gray-6">
            <span className={cn("block h-full rounded-[3px]", tone.bar)} style={{ width: `${Math.round(item.hitRate * 100)}%` }} />
          </span>
          <span className={cn("shrink-0 text-xs font-semibold leading-[1.3]", tone.text)}>
            {Math.round(item.hitRate * 100)}% hit rate
          </span>
        </div>
      </div>
      <div className="flex w-[70px] shrink-0 flex-col items-end gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={active}
          className={cn(
            "flex h-7 items-center rounded-lg px-2 text-xs font-semibold leading-[1.1] transition-colors",
            active
              ? "bg-principal-9 text-gray-1 hover:bg-principal-10"
              : "border border-gray-6 bg-gray-3 text-gray-12 hover:border-gray-8",
          )}
        >
          {active ? "Filtering" : "Filter"}
        </button>
        <span className="text-[11px] text-gray-11">{item.calls} calls</span>
      </div>
    </li>
  );
}

export function TopSourcesPanel({
  items,
  isLoading,
  period,
  onPeriod,
  activeSource,
  onSource,
  className,
}: {
  items: TopSourceItem[] | undefined;
  isLoading: boolean;
  period: SourcePeriod;
  onPeriod: (p: SourcePeriod) => void;
  activeSource: string | undefined;
  onSource: (key: string | undefined) => void;
  className?: string;
}) {
  return (
    <Panel
      title="Top sources"
      className={className}
      right={<Segmented label="Period" options={PERIODS} value={period} onChange={onPeriod} />}
    >
      <ScrollArea className="min-h-0 flex-1" viewportClassName="max-h-full">
        {isLoading ? (
          <SkeletonGroup label="Loading sources">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-2.5 border-b border-gray-6 px-3 py-2">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-7 w-14" />
              </div>
            ))}
          </SkeletonGroup>
        ) : items?.length ? (
          <ol>
            {items.map((s, i) => {
              const key = sourceKey(s);
              return (
                <SourceRow
                  key={key}
                  item={s}
                  rank={i + 1}
                  active={activeSource === key}
                  onToggle={() => onSource(activeSource === key ? undefined : key)}
                />
              );
            })}
          </ol>
        ) : (
          <EmptyState>No call group has 10+ evaluated calls in this period yet.</EmptyState>
        )}
      </ScrollArea>
    </Panel>
  );
}

// ─────────────────────────────── Discovery ───────────────────────────────

const DiscoveryCard = memo(function DiscoveryCard({ item }: { item: DiscoveryItem }) {
  const follow = useFollowWallet();
  const pnl = item.pnl30dUsd;
  return (
    <article
      className={cn(
        "flex flex-col gap-3 border-b px-3 py-2",
        item.following ? "border-green-8 bg-gradient-to-r from-green-1 to-green-3" : "border-gray-6 bg-gray-1",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-8 bg-gray-1 text-[9px] font-semibold text-gray-12">
          {initials(item.address)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2 leading-[1.3]">
          <a
            href={item.chain === "SOLANA" ? `https://solscan.io/account/${item.address}` : `https://debank.com/profile/${item.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm font-semibold text-gray-12 hover:underline"
            title={item.address}
          >
            {shortAddress(item.address)}
          </a>
          {pnl != null && (
            <span className={cn("text-xs", pnl >= 0 ? "text-green-11" : "text-vermelho-11")}>
              {pnl >= 0 ? "+" : ""}
              {compactUsd(pnl)} in 30d
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => follow.mutate(item)}
          disabled={follow.isPending}
          aria-pressed={item.following}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold leading-[1.1] transition-colors disabled:opacity-70",
            item.following
              ? "bg-green-11 text-gray-2 hover:bg-green-10"
              : "border border-gray-6 bg-gray-3 text-gray-12 hover:border-gray-8",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ícones SVG do Figma */}
          <img src={item.following ? "/tracker/star.svg" : "/tracker/plus.svg"} alt="" className={item.following ? "size-3" : "size-4"} />
          {item.following ? "Following" : "Follow"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-[3px]" aria-hidden>
          {item.pattern.map((hit, i) => (
            <span key={i} className={cn("size-2 rounded-full", hit ? "bg-principal-11" : "bg-gray-6")} />
          ))}
        </span>
        <p className="min-w-0 flex-1 text-xs leading-[1.3] text-gray-11">
          caught {item.runnersCaught} of the last {item.runnersTotal} runners
        </p>
      </div>
      {item.tokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {item.tokens.map((t) => (
            <span key={`${t.chain}:${t.mint}`} className="inline-flex items-center gap-1.5">
              <TokenIcon chain={t.chain} mint={t.mint} symbol={t.symbol} size={20} />
              <span className="text-xs font-bold leading-[1.3] text-gray-12">{tokenLabel(t)}</span>
            </span>
          ))}
        </div>
      )}
    </article>
  );
});

export function DiscoveryPanel({
  items,
  isLoading,
  className,
}: {
  items: DiscoveryItem[] | undefined;
  isLoading: boolean;
  className?: string;
}) {
  return (
    <Panel title="Wallets Discovery" className={className}>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="max-h-full">
        {isLoading ? (
          <SkeletonGroup label="Loading discovery">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 border-b border-gray-6 px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-7 w-16" />
                </div>
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-5 w-56" />
              </div>
            ))}
          </SkeletonGroup>
        ) : items?.length ? (
          items.map((w) => <DiscoveryCard key={`${w.chain}:${w.address}`} item={w} />)
        ) : (
          <EmptyState>No wallet outside the index caught 2+ recent runners yet.</EmptyState>
        )}
      </ScrollArea>
    </Panel>
  );
}
