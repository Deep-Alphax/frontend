"use client";

import type { CopyKol } from "@/lib/api/copyTrade";
import { cn } from "@/lib/cn";
import {
  hitLabel,
  kolHandle,
  kolRole,
  pnlTone,
  signedSol,
  tradesLabel,
} from "@/lib/copyTrade/format";
import { tierFor } from "@/lib/walletReader/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dot, KolAvatar, RankTag, tierVars } from "@/components/copyTrade/parts";

/** Cantoneira em "L" de 40 px na cor viva do nível (detalhe-1/2 do Card-kols). */
const CORNER_CLS =
  "pointer-events-none absolute size-10 rounded-tl-lg border-l border-t border-transparent bg-linear-to-b bg-origin-border " +
  "[mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)] [mask-clip:padding-box,border-box] [mask-composite:exclude]";

/**
 * Card de KOL sugerido (node 1571:22679 — "card - copy kol"): mesma essência
 * do Card-kols (arte do nível, anel do avatar, linha em degradê e cantos).
 *
 * Divergência do Figma por falta de fonte (decisão 2026-10-20): no lugar de
 * "44,7 mil seguidores" vai a atividade de 30d. O rodapé traz quantos copiam
 * e o resultado de hoje (o "+21%" de crescimento não tem série histórica).
 */
export function CopyKolCard({
  kol,
  selected,
  onOpen,
}: {
  kol: CopyKol;
  selected: boolean;
  onOpen: () => void;
}) {
  const tier = tierFor(kol.relevance);
  const role = kolRole(kol.types);
  const s = kol.stats;

  return (
    <article
      style={tierVars(tier)}
      className={cn(
        "group relative isolate flex flex-col rounded-lg border transition-[box-shadow,transform]",
        tier.card,
        selected
          ? "shadow-[0_0_0_1px_var(--tier-9),0_0_24px_-4px_var(--tier-9)]"
          : "hover:-translate-y-px",
      )}
    >
      {/* Emblema do nível ao fundo do topo, girado e esmaecido (como o Card-kols). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70px] overflow-hidden rounded-t-lg [mask-image:linear-gradient(to_bottom,#000_0%,rgba(0,0,0,0.8)_24%,transparent_100%)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tier.emblem}
          alt=""
          width={85}
          height={85}
          className="absolute -top-5 left-0 size-[85px] rotate-[18.79deg] object-contain opacity-50"
        />
      </div>

      {/* Perfil */}
      <div className="relative flex items-center gap-2 px-3.5 py-3">
        <KolAvatar kol={kol} tier={tier} ring="border" className="size-10" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-sm leading-[1.3] font-semibold text-gray-12">{kolHandle(kol)}</p>
          <div className="flex min-w-0 items-center gap-2 text-xs leading-[1.3] text-gray-11">
            {role && (
              <>
                <span className="shrink-0">{role}</span>
                <Dot />
              </>
            )}
            <span className="truncate">{tradesLabel(kol)}</span>
          </div>
        </div>
      </div>

      <div className={cn("h-0.5 w-full shrink-0 rounded-[32px] bg-linear-to-r", tier.bar)} />

      {/* Acerto + resultado */}
      <div className="flex items-center border-b border-gray-6 px-3.5 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-3 whitespace-nowrap">
          <p className="text-xs leading-[1.3] font-medium text-gray-11">Hit rate 30d</p>
          <p className="text-base leading-[1.1] font-semibold text-gray-12 tabular-nums">
            {hitLabel(s?.hitRate)}
          </p>
        </div>
        <span aria-hidden className="h-8 w-px shrink-0 bg-gray-6" />
        <div className="flex min-w-0 flex-1 flex-col gap-3 pl-3.5 whitespace-nowrap">
          <p className="text-xs leading-[1.3] font-medium text-gray-11">Result 30d</p>
          <p className={cn("text-base leading-[1.1] font-semibold tabular-nums", pnlTone(s?.pnlSol))}>
            {s ? signedSol(s.pnlSol) : "—"}
          </p>
        </div>
      </div>

      {/* Rodapé: hoje + nível */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs leading-[1.3] text-gray-11">
          <span className="shrink-0 tabular-nums">{kol.copiers.toLocaleString("en-US")} copying</span>
          <Dot />
          <span className={cn("truncate tabular-nums", s?.pnl24hSol ? pnlTone(s.pnl24hSol) : "")}>
            today {s ? signedSol(s.pnl24hSol) : "—"}
          </span>
        </div>
        <RankTag tier={tier} variant="strong" />
      </div>

      <span aria-hidden className={cn(CORNER_CLS, "-top-px -left-px", tier.corner)} />
      <span aria-hidden className={cn(CORNER_CLS, "-right-px -bottom-px rotate-180", tier.corner)} />

      <button
        type="button"
        onClick={onOpen}
        aria-pressed={selected}
        aria-label={`Open ${kolHandle(kol)}`}
        className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principal-9"
      />
    </article>
  );
}

export function CopyKolCardSkeleton() {
  return (
    <div className="flex h-[166px] flex-col rounded-lg border border-gray-6 bg-gray-2">
      <div className="flex items-center gap-2 px-3.5 py-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-0.5 w-full rounded-none" />
      <div className="flex gap-4 border-b border-gray-6 px-3.5 py-3">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 flex-1" />
      </div>
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** O que o mini card mostra à direita e na 2ª linha, por trilha. */
export type MiniMetric = "today" | "hit" | "pnl";

/**
 * Card compacto das trilhas horizontais (node 1601:26251 — "card - kol mini").
 * `today` (Trending today): nome + rank / "+41 SOL hoje". `hit` e `pnl`
 * (Highest hit rate, New in Deep Ranking): nome + rank na mesma linha,
 * papel · acerto embaixo e "+97 SOL 30d" à direita.
 */
export function KolMiniCard({
  kol,
  metric,
  selected,
  onOpen,
}: {
  kol: CopyKol;
  metric: MiniMetric;
  selected: boolean;
  onOpen: () => void;
}) {
  const tier = tierFor(kol.relevance);
  const s = kol.stats;
  const role = kolRole(kol.types);
  const value = metric === "today" ? s?.pnl24hSol : s?.pnlSol;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      style={tierVars(tier)}
      className={cn(
        "flex h-[60px] shrink-0 items-center gap-2 rounded-lg border p-3 text-left transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principal-9",
        tier.card,
        selected && "shadow-[0_0_0_1px_var(--tier-9)]",
      )}
    >
      <KolAvatar kol={kol} tier={tier} className="size-8" />
      {metric === "today" ? (
        <div className="flex flex-col items-start gap-2">
          <span className="text-sm leading-[1.3] font-semibold whitespace-nowrap text-gray-12">
            {kolHandle(kol)}
          </span>
          <RankTag tier={tier} />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <span className="flex items-center gap-1">
            <span className="text-sm leading-[1.3] font-semibold whitespace-nowrap text-gray-12">
              {kolHandle(kol)}
            </span>
            <RankTag tier={tier} />
          </span>
          <span className="flex items-center gap-2 text-xs leading-[1.3] whitespace-nowrap text-gray-11">
            {role && (
              <>
                <span>{role}</span>
                <Dot />
              </>
            )}
            <span>{hitLabel(s?.hitRate)} hit rate</span>
          </span>
        </div>
      )}
      <span className="ml-auto flex flex-col items-end gap-2 pl-2 text-right leading-[1.3] whitespace-nowrap">
        <span className={cn("text-sm font-semibold tabular-nums", pnlTone(value))}>
          {value == null ? "—" : signedSol(value, metric === "today")}
        </span>
        <span className="text-xs text-gray-11">{metric === "today" ? "today" : "SOL 30d"}</span>
      </span>
    </button>
  );
}

export function KolMiniCardSkeleton() {
  return (
    <div className="flex h-[60px] w-[234px] shrink-0 items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 p-3">
      <Skeleton className="size-8 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-6 w-12" />
    </div>
  );
}
