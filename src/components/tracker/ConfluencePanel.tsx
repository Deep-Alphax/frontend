"use client";

import type { ConfluenceItem } from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import { age, compactUsd, signedPct } from "@/lib/tracker/format";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import {
  BuyButton,
  CopyButton,
  DataChip,
  EmptyState,
  LiveChip,
  Panel,
  TokenIcon,
} from "@/components/tracker/parts";

/*
 * Arcos do anel de score (Figma "Property 1=N", viewBox 44×44, traço 4). A
 * ordem de preenchimento do componente começa às 3h e segue no sentido
 * horário: o 1º segmento aceso é o 3º path do SVG.
 */
const ARCS = [
  "M23.5671 1.99385C27.79 2.3258 31.7995 3.9857 35.0214 6.7358",
  "M37.252 8.96596C40.0021 12.1878 41.662 16.1973 41.9939 20.4203",
  "M41.9939 23.5671C41.662 27.79 40.0021 31.7995 37.252 35.0214",
  "M35.0214 37.2518C31.7995 40.0019 27.79 41.6618 23.5671 41.9937",
  "M20.4205 41.9937C16.1975 41.6618 12.188 40.0019 8.96617 37.2518",
  "M6.7358 35.0214C3.9857 31.7995 2.3258 27.79 1.99385 23.5671",
  "M1.99385 20.4203C2.3258 16.1973 3.9857 12.1878 6.7358 8.96596",
  "M8.96617 6.7358C12.188 3.9857 16.1975 2.3258 20.4205 1.99385",
];
const FILL_ORDER = [2, 3, 4, 5, 6, 7, 0, 1];

/** Score 0–10 → segmentos acesos (0–8). */
export function litSegments(score: number): number {
  return Math.max(0, Math.min(8, Math.round((score / 10) * 8)));
}

function ScoreRing({ score }: { score: number }) {
  const lit = new Set(FILL_ORDER.slice(0, litSegments(score)));
  return (
    <div
      className="relative flex size-10 shrink-0 items-center justify-center"
      role="img"
      aria-label={`Confluence score ${score} of 10`}
    >
      <span className="text-lg font-semibold leading-[1.1] text-gray-12">{score}</span>
      <svg viewBox="0 0 43.9878 43.9876" fill="none" className="absolute -inset-[2px] size-11" aria-hidden>
        {ARCS.map((d, i) => (
          <path
            key={i}
            d={d}
            strokeWidth={4}
            className={lit.has(i) ? "stroke-principal-11" : "stroke-gray-6"}
          />
        ))}
      </svg>
    </div>
  );
}

function ConfluenceCard({ item }: { item: ConfluenceItem }) {
  const { token } = item;
  const hot = item.score >= 7;
  const change = item.changeSinceFirst;
  return (
    <article className="relative flex flex-col gap-3 border-b border-gray-6 py-3 pl-4 pr-3">
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-[92px] w-1 -translate-y-1/2 rounded-r",
          hot ? "bg-principal-11" : "bg-gray-8",
        )}
      />
      <div className="flex items-center gap-3">
        <ScoreRing score={item.score} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <TokenIcon chain={token.chain} mint={token.mint} symbol={token.symbol} imageUrl={token.imageUrl} badge={false} />
            <span className="truncate text-sm font-semibold leading-[1.1] text-gray-12">
              ${token.symbol ?? "???"}
            </span>
            <CopyButton value={token.mint} boxed={false} size={20} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <DataChip>MC {compactUsd(token.mcUsd)}</DataChip>
            <DataChip>{age(item.firstBuyAt)}</DataChip>
            {item.live && <LiveChip />}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-lg border border-laranja-6 bg-laranja-2 px-2 py-1.5 text-xs font-semibold leading-[1.3] text-laranja-11">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
          <img src="/tracker/wallet.svg" alt="" className="size-3" />
          {item.wallets} wallets
        </span>
        <div className="flex items-center gap-2">
          {change != null && (
            <span
              className={cn(
                "text-sm font-semibold leading-[1.1]",
                change >= 0 ? "text-green-11" : "text-vermelho-11",
              )}
            >
              {signedPct(change)}
            </span>
          )}
          <BuyButton chain={token.chain} mint={token.mint} small />
        </div>
      </div>
    </article>
  );
}

export function ConfluencePanel({
  items,
  isLoading,
  className,
}: {
  items: ConfluenceItem[] | undefined;
  isLoading: boolean;
  className?: string;
}) {
  return (
    <Panel title="Confluence" className={className}>
      <ScrollArea className="min-h-0 flex-1" viewportClassName="max-h-full">
        {isLoading ? (
          <SkeletonGroup label="Loading confluence">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex flex-col gap-3 border-b border-gray-6 py-3 pl-4 pr-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-6 w-40" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-7 w-24" />
                </div>
              </div>
            ))}
          </SkeletonGroup>
        ) : items?.length ? (
          items.map((it) => <ConfluenceCard key={`${it.token.chain}:${it.token.mint}`} item={it} />)
        ) : (
          <EmptyState>No token was bought by 3+ KOLs in the last hour.</EmptyState>
        )}
      </ScrollArea>
    </Panel>
  );
}
