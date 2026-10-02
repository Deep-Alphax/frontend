"use client";

import type { TrackerFeedItem, TrackerTrade } from "@/lib/api/tracker";
import { cn } from "@/lib/cn";
import { ago, compactUsd, initials, quoteAmount, signedUsd } from "@/lib/tracker/format";
import { hashStr } from "@/lib/walletReader/types";
import {
  BuyButton,
  ChainChip,
  CopyButton,
  RankTag,
  TokenIcon,
} from "@/components/tracker/parts";

/*
 * card - wallet conversa (Figma 1342:32050): a call vira o BALÃO e o
 * movimento on-chain vira a RESPOSTA (ligada por um gancho em L). A relação
 * call × trade sai num chip: comprou antes (verde), vendeu depois (vermelho),
 * entrou depois (âmbar). Strike = fundo dourado + estatísticas da aposta.
 */

/** Anel do avatar — determinístico por KOL (o Figma usa violeta/azul…). */
const AVATAR_RINGS = [
  "border-violeta-11",
  "border-secundaria-11",
  "border-green-11",
  "border-menta-11",
  "border-laranja-11",
  "border-principal-11",
];

function relationChip(t: TrackerTrade): { text: string; cls: string } | null {
  if (!t.relation) return null;
  const when = `${t.relation.minutes} min ${t.relation.kind === "before" ? "before" : "after"} the call`;
  if (t.relation.kind === "before") {
    return { text: when, cls: "border-green-6 bg-green-3 text-green-11" };
  }
  return t.side === "SELL"
    ? { text: when, cls: "border-vermelho-6 bg-vermelho-3 text-vermelho-11" }
    : { text: when, cls: "border-principal-8 bg-principal-4 text-principal-11" };
}

/** Uma linha de resposta (BOUGHT/SOLD …). `compact` = linhas seguintes (menores). */
function TradeRow({
  item,
  trade,
  compact,
  strikeMultiple,
  first,
}: {
  item: TrackerFeedItem;
  trade: TrackerTrade;
  compact: boolean;
  strikeMultiple: number | null;
  first: boolean;
}) {
  const { token } = item;
  const buy = trade.side === "BUY";
  const rel = relationChip(trade);
  return (
    <div className="relative flex flex-wrap items-center gap-[7px] pl-4">
      <span
        aria-hidden
        className={cn(
          "absolute left-1 w-2.5 rounded-bl-lg border-b-2 border-l-2 border-gray-6",
          first ? "-top-1.5 h-4" : "-top-3.5 h-6",
        )}
      />
      <span
        className={cn(
          "inline-flex items-center rounded border p-1.5 text-xs font-medium leading-[1.3]",
          buy ? "border-green-6 bg-green-3 text-green-11" : "border-vermelho-6 bg-vermelho-3 text-vermelho-11",
        )}
      >
        {buy ? "BOUGHT" : "SOLD"}
      </span>
      <span
        className={cn(
          "font-semibold text-gray-12",
          compact ? "text-[13.5px] leading-normal" : "text-sm leading-[1.1]",
        )}
      >
        {/* Trade do app FOMO vem só em USD (sem tx on-chain). */}
        {trade.quoteSymbol === "USD"
          ? compactUsd(trade.quoteAmount)
          : `${quoteAmount(trade.quoteAmount)} ${trade.quoteSymbol}`}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <TokenIcon
          chain={token.chain}
          mint={token.mint}
          symbol={token.symbol}
          imageUrl={token.imageUrl}
          size={compact ? 18 : 24}
        />
        <span
          className={cn(
            "text-gray-12",
            compact ? "text-[13.5px] font-bold leading-normal" : "text-sm font-semibold leading-[1.1]",
          )}
        >
          ${token.symbol ?? "???"}
        </span>
      </span>
      <CopyButton value={token.mint} size={compact ? 22 : 24} />
      <ChainChip chain={token.chain} />
      <span className={cn("text-gray-11", compact ? "text-[13px]" : "text-sm leading-[1.3]")}>
        MC {compactUsd(trade.mcUsd)}
      </span>
      {strikeMultiple != null ? (
        <span className="inline-flex items-center rounded border border-principal-8 bg-principal-5 px-2 py-1.5 text-xs font-semibold leading-[1.3] text-principal-9">
          {strikeMultiple.toFixed(1)}x the median bet
        </span>
      ) : (
        rel && (
          <span className={cn("inline-flex items-center rounded border px-2 py-1.5 text-xs font-medium leading-[1.3]", rel.cls)}>
            {rel.text}
          </span>
        )
      )}
    </div>
  );
}

/** Régua de acertos (8 de 11): barras de 5×11. */
function HitsBar({ hits }: { hits: boolean[] }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {hits.map((h, i) => (
        <span key={i} className={cn("h-[11px] w-[5px] rounded-[2px]", h ? "bg-green-11" : "bg-gray-6")} />
      ))}
    </span>
  );
}

function StatChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded border border-gray-6 bg-gray-1 px-[9px] py-[3px] text-xs leading-[1.3] text-gray-11">
      {children}
    </span>
  );
}

export function FeedCard({ item }: { item: TrackerFeedItem }) {
  const strike = item.status === "strike" && item.strike;
  const handle = item.kol.handle ? `@${item.kol.handle}` : item.kol.name;
  const ring = AVATAR_RINGS[hashStr(item.kol.id) % AVATAR_RINGS.length];
  const meta = item.call
    ? `on ${item.call.group ?? "a call group"}, ${ago(item.call.at)}`
    : item.trades.length
      ? ago(item.lastActivityAt)
      : "no public call";
  const hits = strike ? item.strike!.hits : [];

  return (
    <article
      className={cn(
        "flex items-start gap-3 border-b px-3 py-4",
        strike
          ? "border-principal-11 bg-gradient-to-r from-principal-3 from-40% to-principal-1"
          : "border-gray-6 bg-gray-2",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full border-2 bg-gray-1 text-[11px] font-semibold text-gray-12",
          ring,
        )}
        aria-hidden
      >
        {initials(item.kol.handle ?? item.kol.name)}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <header className="flex flex-wrap items-center gap-1.5">
          {strike && (
            <span className="inline-flex h-6 items-center gap-1 rounded-[5px] bg-principal-9 px-2 py-1.5 text-xs font-semibold leading-[1.3] text-principal-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- ícone SVG do Figma */}
              <img src="/tracker/flash.svg" alt="" className="size-4" />
              HEAVY STRIKE
            </span>
          )}
          <span className="text-sm font-semibold leading-[1.1] text-gray-12">{handle}</span>
          <RankTag relevance={item.kol.relevance} />
          <span className="text-sm leading-[1.3] text-gray-11">{meta}</span>
        </header>

        {item.call ? (
          <p className="w-fit max-w-[520px] whitespace-pre-line break-words rounded-b-lg rounded-tl rounded-tr-lg border border-gray-6 bg-gray-1 px-3 py-2.5 text-sm leading-[1.3] text-gray-12">
            {item.call.text}
          </p>
        ) : (
          <p className="w-fit max-w-[520px] rounded-b-lg rounded-tl rounded-tr-lg border border-dashed border-gray-6 bg-gray-1 px-3 py-2.5 text-[12.5px] italic text-gray-12">
            Didn&apos;t post about this token
          </p>
        )}

        {item.trades.map((t, i) => (
          <TradeRow
            key={t.id}
            item={item}
            trade={t}
            first={i === 0}
            compact={i > 0}
            strikeMultiple={strike && i === item.trades.length - 1 && t.side === "BUY" ? item.strike!.medianMultiple : null}
          />
        ))}

        {strike && (
          <div className="flex flex-wrap items-center gap-1.5 pl-4">
            {item.strike!.balancePct != null && (
              <StatChip>{Math.round(item.strike!.balancePct)}% of balance</StatChip>
            )}
            {item.strike!.largest30d && <StatChip>Largest in 30 days</StatChip>}
            {hits.length > 0 && (
              <StatChip>
                <HitsBar hits={hits} />
                {hits.filter(Boolean).length} of {hits.length} hits
              </StatChip>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between self-stretch">
        <div className="flex h-[30px] items-center justify-end">
          {item.pnlUsd != null && item.trades.length > 0 && (
            <span
              className={cn(
                "text-base font-semibold leading-[1.1]",
                item.pnlUsd >= 0 ? "text-green-11" : "text-vermelho-11",
              )}
            >
              {signedUsd(item.pnlUsd)}
            </span>
          )}
        </div>
        <BuyButton chain={item.token.chain} mint={item.token.mint} />
      </div>
    </article>
  );
}
