"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import type { CopyKol, CopyTradeSort, KolRef } from "@/lib/api/copyTrade";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useCopyKols, useCopyTradeHome } from "@/lib/copyTrade/useCopyTrade";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { CopyFaq } from "@/components/copyTrade/CopyFaq";
import { CopyFeedTable } from "@/components/copyTrade/CopyFeedTable";
import {
  ChartUpIcon,
  PlusSmallIcon,
  SearchIcon,
  StarIcon,
  TargetIcon,
} from "@/components/copyTrade/icons";
import {
  CopyKolCard,
  CopyKolCardSkeleton,
  KolMiniCard,
  KolMiniCardSkeleton,
  type MiniMetric,
} from "@/components/copyTrade/KolCards";
import { SectionTitle, TagButton } from "@/components/copyTrade/parts";

/**
 * Filtros (node 1578:26233). "For you" = a home em seções; os outros viram
 * uma grade paginada na ordem do filtro. "Seguindo" do Figma fica de fora:
 * ainda não existe "seguir KOL" (só seguir carteira do Discovery).
 */
type View = "forYou" | CopyTradeSort;

const VIEWS: Array<{ id: View; label: string }> = [
  { id: "forYou", label: "For you" },
  { id: "pnl", label: "All" },
  { id: "hit", label: "Highest hit rate" },
  { id: "today", label: "Trending today" },
];

/** Grade de cards: 4 colunas com 2 colunas abertas, 2 com o detalhe aberto. */
const GRID = "grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4";

interface Props {
  enabled: boolean;
  selectedId: string | null;
  onOpen: (kol: CopyKol) => void;
}

interface ScreenProps extends Props {
  /** Usuário já tem copies: "For you" vira grade + "Agora nos seus copies" (Figma 1576:22569). */
  hasCopies: boolean;
  /** Execução em shadow — o feed diz "simulado". */
  simulated: boolean;
  onOpenRef: (kol: KolRef) => void;
}

/**
 * Coluna central "Carteiras para copiar" (Figma 1578:26227): cabeçalho com
 * busca (⌘K), filtros e — em "For you" — as seções Para você, Em alta hoje,
 * Maior acerto, Novos no Deep Ranking e Dúvidas comuns.
 */
export function WalletsToCopy({ enabled, selectedId, onOpen, hasCopies, simulated, onOpenRef }: ScreenProps) {
  const [view, setView] = useState<View>("forYou");
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(input.trim().replace(/^@/, "")), 300);
    return () => clearTimeout(t);
  }, [input]);

  // ⌘K / Ctrl+K foca a busca (o atalho que o campo anuncia).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Buscar em "For you" procura em todos.
  const gridSort: CopyTradeSort | null = view === "forYou" ? (q ? "pnl" : null) : view;

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-8 sm:px-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div className="flex min-w-[280px] flex-1 flex-col gap-3">
            <h2 className="font-display text-base leading-[1.1] font-semibold tracking-[1px] text-gray-12">
              Wallets to copy
            </h2>
            <p className="text-xs leading-[1.3] text-gray-11">
              Deep Alpha KOLs with an on-chain verified track record. Click to see everything they did.
            </p>
          </div>
          <label className="flex h-10 w-full items-center gap-3 rounded-lg border border-gray-6 bg-gray-2 px-3 focus-within:border-gray-8 sm:w-[280px]">
            <SearchIcon className="size-5 shrink-0 text-gray-11" />
            <span className="sr-only">Search KOL</span>
            <input
              ref={searchRef}
              type="search"
              value={input}
              maxLength={40}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search KOL"
              className="min-w-0 flex-1 bg-transparent text-sm leading-[1.3] text-gray-12 outline-none placeholder:text-gray-11"
            />
            <kbd className="rounded border border-gray-6 bg-gray-1 p-1.5 font-body text-xs leading-[1.3] text-gray-11">
              ⌘ K
            </kbd>
          </label>
        </div>
        <div role="group" aria-label="Filter wallets" className="flex flex-wrap items-start gap-1">
          {VIEWS.map((v) => (
            <TagButton key={v.id} selected={view === v.id} onClick={() => setView(v.id)}>
              {v.label}
            </TagButton>
          ))}
        </div>
      </div>

      {gridSort ? (
        <KolGrid
          sort={gridSort}
          q={q}
          enabled={enabled}
          selectedId={selectedId}
          onOpen={onOpen}
        />
      ) : hasCopies ? (
        <>
          <KolGrid sort="pnl" q="" limit={8} enabled={enabled} selectedId={selectedId} onOpen={onOpen} />
          <CopyFeedTable enabled={enabled} simulated={simulated} onOpen={onOpenRef} />
        </>
      ) : (
        <HomeSections enabled={enabled} selectedId={selectedId} onOpen={onOpen} onView={setView} />
      )}
    </div>
  );
}

function HomeSections({
  enabled,
  selectedId,
  onOpen,
  onView,
}: Props & { onView: (v: View) => void }) {
  const home = useCopyTradeHome(enabled);
  const d = home.data;
  const loading = !d && (home.isLoading || !enabled);

  if (home.isError && !d) {
    return <ErrorNote message={getApiErrorMessage(home.error)} onRetry={() => home.refetch()} />;
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <SectionTitle
          icon={<StarIcon className="size-3" />}
          title="For you"
          hint="best results in the last 30 days"
        />
        {loading ? (
          <SkeletonGroup label="Loading wallets" className={GRID}>
            {Array.from({ length: 4 }, (_, i) => (
              <CopyKolCardSkeleton key={i} />
            ))}
          </SkeletonGroup>
        ) : d!.forYou.length ? (
          <div className={GRID}>
            {d!.forYou.map((k) => (
              <CopyKolCard key={k.id} kol={k} selected={k.id === selectedId} onOpen={() => onOpen(k)} />
            ))}
          </div>
        ) : (
          <Empty text="No KOL traded in SOL in the last 30 days yet." />
        )}
      </section>

      <Rail
        icon={<ChartUpIcon className="size-[11px]" />}
        title="Trending today"
        hint="best result in the last 24 h"
        items={d?.trending}
        loading={loading}
        metric="today"
        empty="No KOL is up today yet."
        action={{ label: "See all", onClick: () => onView("today") }}
        selectedId={selectedId}
        onOpen={onOpen}
      />
      <Rail
        icon={<TargetIcon className="size-3" />}
        title="Highest hit rate"
        hint="30 days, at least 40 trades"
        items={d?.topHit}
        loading={loading}
        metric="hit"
        empty="No KOL has 40 evaluated buys in the last 30 days yet."
        action={{ label: "See all", onClick: () => onView("hit") }}
        selectedId={selectedId}
        onOpen={onOpen}
      />
      <Rail
        icon={<PlusSmallIcon className="size-2" />}
        title="New in Deep Ranking"
        hint="joined the season this week"
        items={d?.newInRanking}
        loading={loading}
        metric="pnl"
        empty="No new KOL in the season this week."
        link={{ label: "See all", href: "/wallet-reader/ranking" }}
        selectedId={selectedId}
        onOpen={onOpen}
      />

      <CopyFaq />
    </>
  );
}

/** Trilha horizontal de mini cards (Em alta hoje / Maior acerto / Novos). */
function Rail({
  icon,
  title,
  hint,
  items,
  loading,
  metric,
  empty,
  action,
  link,
  selectedId,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  items: CopyKol[] | undefined;
  loading: boolean;
  metric: MiniMetric;
  empty: string;
  action?: { label: string; onClick: () => void };
  link?: { label: string; href: string };
  selectedId: string | null;
  onOpen: (kol: CopyKol) => void;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <SectionTitle icon={icon} title={title} hint={hint} action={action} />
        </div>
        {link && (
          <Link
            href={link.href}
            className="shrink-0 text-xs leading-[1.3] font-medium text-gray-11 transition-colors hover:text-gray-12"
          >
            {link.label} →
          </Link>
        )}
      </div>
      {loading ? (
        <SkeletonGroup label={`Loading ${title}`} className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <KolMiniCardSkeleton key={i} />
          ))}
        </SkeletonGroup>
      ) : items?.length ? (
        <ScrollArea orientation="horizontal" className="w-full">
          <ul className="flex gap-3 pb-2">
            {items.map((k) => (
              <li key={k.id}>
                <KolMiniCard kol={k} metric={metric} selected={k.id === selectedId} onOpen={() => onOpen(k)} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      ) : (
        <Empty text={empty} />
      )}
    </section>
  );
}

/** Grade paginada ("All", "Highest hit rate", "Trending today" e busca). */
function KolGrid({
  sort,
  q,
  enabled,
  selectedId,
  onOpen,
  limit,
}: Props & { sort: CopyTradeSort; q: string; limit?: number }) {
  const kols = useCopyKols(sort, q, enabled);
  const all = useMemo(() => kols.data?.pages.flatMap((p) => p.items) ?? [], [kols.data]);
  const items = limit ? all.slice(0, limit) : all;
  const total = kols.data?.pages[0]?.total ?? 0;

  if (kols.isError && !kols.data) {
    return <ErrorNote message={getApiErrorMessage(kols.error)} onRetry={() => kols.refetch()} />;
  }
  if (!kols.data) {
    return (
      <SkeletonGroup label="Loading wallets" className={GRID}>
        {Array.from({ length: limit ?? 8 }, (_, i) => (
          <CopyKolCardSkeleton key={i} />
        ))}
      </SkeletonGroup>
    );
  }
  if (!items.length) {
    return (
      <Empty
        text={
          q
            ? `No KOL matches "${q}".`
            : sort === "hit"
              ? "No KOL has 40 evaluated buys in the last 30 days yet."
              : sort === "today"
                ? "No KOL is up today yet."
                : "No KOL in the index yet."
        }
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", kols.isPlaceholderData && "opacity-60")}>
      {!limit && (
        <p className="text-xs leading-[1.3] text-gray-11">
          {total.toLocaleString("en-US")} {total === 1 ? "wallet" : "wallets"}
        </p>
      )}
      <div className={GRID}>
        {items.map((k) => (
          <CopyKolCard key={k.id} kol={k} selected={k.id === selectedId} onOpen={() => onOpen(k)} />
        ))}
      </div>
      {!limit && kols.hasNextPage && (
        <button
          type="button"
          onClick={() => kols.fetchNextPage()}
          disabled={kols.isFetchingNextPage}
          className="self-center rounded-lg border border-gray-6 bg-gray-3 px-4 py-2 text-sm font-medium text-gray-12 transition-colors hover:bg-gray-4 disabled:opacity-60"
        >
          {kols.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-gray-6 px-4 py-6 text-center text-sm text-gray-11">
      {text}
    </p>
  );
}

function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-vermelho-6 bg-vermelho-2 px-4 py-3 text-sm text-vermelho-11">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 font-medium underline">
        Retry
      </button>
    </div>
  );
}
