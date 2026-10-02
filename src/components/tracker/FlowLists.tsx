"use client";

import type { MultiBuyItem, NetFlowItem, TrackerToken } from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import { ago, compactUsd, signedUsd, tokenLabel } from "@/lib/tracker/format";
import { BuyButton, ChainChip, CopyButton, DataChip, EmptyState, TokenIcon } from "@/components/tracker/parts";

/*
 * Abas "Multi Buys" e "Net Flows" do feed central. O Figma desenha só a aba
 * Activity; estas linhas reusam a mesma linguagem do card (token, rede, MC,
 * Buy) para não inventar um visual novo.
 */

function TokenCell({ token }: { token: TrackerToken }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <TokenIcon chain={token.chain} mint={token.mint} symbol={token.symbol} imageUrl={token.imageUrl} />
      <span className="truncate text-sm font-semibold leading-[1.1] text-gray-12">{tokenLabel(token)}</span>
      <CopyButton value={token.mint} />
      <ChainChip chain={token.chain} />
    </div>
  );
}

export function MultiBuysList({ items }: { items: MultiBuyItem[] }) {
  if (!items.length) return <EmptyState>No token was bought by 2+ KOLs in the last 6 hours.</EmptyState>;
  return (
    <ul>
      {items.map((it) => (
        <li
          key={`${it.token.chain}:${it.token.mint}`}
          className="flex flex-wrap items-center gap-3 border-b border-gray-6 bg-gray-2 px-3 py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <TokenCell token={it.token} />
            <div className="flex flex-wrap items-center gap-1.5">
              <DataChip>MC {compactUsd(it.token.mcUsd)}</DataChip>
              <DataChip>{compactUsd(it.buyUsd)} bought</DataChip>
              <DataChip>last {ago(it.lastBuyAt)}</DataChip>
            </div>
            <p className="truncate text-xs leading-[1.3] text-gray-11">
              {it.kols.map((k) => k.name).join(" · ")}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg border border-laranja-6 bg-laranja-2 px-2 py-1.5 text-xs font-semibold leading-[1.3] text-laranja-11">
            {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
            <img src="/tracker/wallet.svg" alt="" className="size-3" />
            {it.wallets} wallets
          </span>
          <BuyButton chain={it.token.chain} mint={it.token.mint} />
        </li>
      ))}
    </ul>
  );
}

export function NetFlowsList({ items }: { items: NetFlowItem[] }) {
  if (!items.length) return <EmptyState>No KOL flow in the last 24 hours.</EmptyState>;
  const max = Math.max(...items.map((i) => Math.max(i.buyUsd, i.sellUsd)), 1);
  return (
    <ul>
      {items.map((it) => (
        <li
          key={`${it.token.chain}:${it.token.mint}`}
          className="flex flex-wrap items-center gap-3 border-b border-gray-6 bg-gray-2 px-3 py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <TokenCell token={it.token} />
            <div className="flex items-center gap-2 text-xs leading-[1.3] text-gray-11">
              <span className="w-24 text-green-11">In {compactUsd(it.buyUsd)}</span>
              <span className="h-[3px] flex-1 overflow-hidden rounded-[3px] bg-gray-6">
                <span className="block h-full rounded-[3px] bg-green-11" style={{ width: `${(it.buyUsd / max) * 100}%` }} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs leading-[1.3] text-gray-11">
              <span className="w-24 text-vermelho-11">Out {compactUsd(it.sellUsd)}</span>
              <span className="h-[3px] flex-1 overflow-hidden rounded-[3px] bg-gray-6">
                <span className="block h-full rounded-[3px] bg-vermelho-11" style={{ width: `${(it.sellUsd / max) * 100}%` }} />
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={cn(
                "text-base font-semibold leading-[1.1]",
                it.netUsd >= 0 ? "text-green-11" : "text-vermelho-11",
              )}
            >
              {signedUsd(it.netUsd)}
            </span>
            <span className="text-[11px] text-gray-11">{it.wallets} wallets</span>
          </div>
          <BuyButton chain={it.token.chain} mint={it.token.mint} />
        </li>
      ))}
    </ul>
  );
}
