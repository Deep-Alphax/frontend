"use client";

import { useState } from "react";

import type { CopyFeedItem, KolRef } from "@/lib/api/copyTrade";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { decisionLabel, type DecisionTone } from "@/lib/copyTrade/config";
import { multipleLabel, sol } from "@/lib/copyTrade/format";
import { useCopyFeed } from "@/lib/copyTrade/useCopies";
import { age, compactUsd, tokenLabel } from "@/lib/tracker/format";
import { tierFor } from "@/lib/walletReader/types";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/copyTrade/controls";
import { Dot, KolAvatar } from "@/components/copyTrade/parts";

const PAGE_SIZE = 10;

const TONE: Record<DecisionTone, string> = {
  green: "text-green-11",
  red: "text-vermelho-11",
  gray: "text-gray-11",
  yellow: "text-principal-11",
};

/**
 * "Agora nos seus copies" (Figma 1655:39309): o que as carteiras fizeram e o
 * que você fez junto — 10 linhas por página, zebrado. Clicar na linha abre a
 * carteira na 3ª coluna.
 */
export function CopyFeedTable({
  enabled,
  simulated,
  onOpen,
}: {
  enabled: boolean;
  simulated: boolean;
  onOpen: (kol: KolRef) => void;
}) {
  const [page, setPage] = useState(1);
  const feed = useCopyFeed(page, enabled);
  const d = feed.data;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-green-9 shadow-[0_0_0_4px_rgba(113,208,131,0.25)]" />
        <h3 className="text-sm leading-[1.1] font-semibold text-gray-12">Now in your copies</h3>
        <p className="min-w-0 flex-1 truncate text-right text-xs leading-[1.3] text-gray-11">
          {simulated ? "what the wallets did and what you would have done (simulated)" : "what the wallets did and what you did along"}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-5 bg-gray-2">
        <div className="flex items-center gap-3 border-b border-gray-5 p-3 text-xs leading-[1.3] text-gray-11">
          <span className="w-12 shrink-0">When</span>
          <span className="flex-1">Wallet and action</span>
          <span className="shrink-0">Your result</span>
        </div>

        {feed.isError && !d ? (
          <p className="p-4 text-sm text-vermelho-11">{getApiErrorMessage(feed.error)}</p>
        ) : !d ? (
          <SkeletonGroup label="Loading activity" className="flex flex-col">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="size-7 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </SkeletonGroup>
        ) : d.items.length ? (
          <>
            <ol className={cn(feed.isPlaceholderData && "opacity-60")}>
              {d.items.map((it, i) => (
                <li key={it.id}>
                  <FeedRow item={it} zebra={i % 2 === 1} onOpen={() => onOpen(it.kol)} />
                </li>
              ))}
            </ol>
            <Pagination page={d.page} pageSize={PAGE_SIZE} total={d.total} noun="events" onPage={setPage} />
          </>
        ) : (
          <p className="p-6 text-center text-sm text-gray-11">
            Nothing yet. When a wallet you copy buys or sells, it shows up here.
          </p>
        )}
      </div>
    </section>
  );
}

function FeedRow({ item: it, zebra, onOpen }: { item: CopyFeedItem; zebra: boolean; onOpen: () => void }) {
  const tier = tierFor(it.kol.relevance);
  const you = decisionLabel(it);
  const score = /^deep_score:(\d+)$/.exec(it.reason ?? "")?.[1];
  const detail =
    it.side === "SELL"
      ? it.kolMultiple != null
        ? multipleLabel(it.kolMultiple)
        : null
      : it.kolQuoteSol != null
        ? sol(it.kolQuoteSol)
        : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-gray-4", zebra && "bg-gray-3")}
    >
      <time dateTime={it.at} className="w-12 shrink-0 text-xs leading-[1.3] text-gray-11">
        {age(it.at)}
      </time>
      <KolAvatar kol={it.kol} tier={tier} className="size-7" />
      <span className="flex min-w-0 flex-1 flex-col gap-3">
        <span className="flex min-w-0 items-start gap-1.5 text-xs leading-[1.3] whitespace-nowrap">
          <span className="truncate font-semibold text-gray-12">{it.kol.label}</span>
          <span className="text-gray-11">
            {it.side === "BUY" ? "Bought" : "Sold"} {tokenLabel(it.token)}
          </span>
        </span>
        <span className="flex items-center gap-2 text-xs leading-[1.3] text-gray-11">
          {detail && (
            <>
              <span>{detail}</span>
              <Dot />
            </>
          )}
          <span>{score ? `Deep Score ${score}` : it.kolMcUsd != null ? `MC ${compactUsd(it.kolMcUsd)}` : "—"}</span>
        </span>
      </span>
      <span className={cn("shrink-0 text-right text-xs leading-[1.3] font-semibold whitespace-nowrap", TONE[you.tone])}>
        {you.text}
      </span>
    </button>
  );
}
