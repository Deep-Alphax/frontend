"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import {
  getFeedMessages,
  nextFeedPage,
  type CapturedMessage,
  type FeedPageParam,
} from "@/lib/api/feed";
import { ChatMessageList } from "@/components/radar/ChatMessageList";
import { fmtCount } from "@/components/radar/groupAvatar";
import { RICK_BOT_TAG } from "@/components/radar/rickBot";
import { ProLock } from "@/components/plans/ProLock";
import { usePlan } from "@/lib/billing/usePlan";
import { MessageSkeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/**
 * A chave de query espelha a do perfil (`["feed-author", tag]`), então o realtime
 * (`feed:new` em useRadarFeed) já faz prepend das capturas do Rick sem código extra.
 */
const RICK_QUERY_KEY = ["feed-author", RICK_BOT_TAG] as const;

/** Badge de contagem do header (tokens do DS: principal 3/8/11). */
function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-xl border border-principal-8 bg-principal-3 px-2 py-1 text-sm leading-none tabular-nums text-principal-11">
      {children}
    </span>
  );
}

/** Achata as páginas e deduplica por id (paginação por offset pode repetir). */
function flattenUnique(pages: { items: CapturedMessage[] }[] | undefined): CapturedMessage[] {
  const seen = new Set<string>();
  const out: CapturedMessage[] = [];
  for (const p of pages ?? []) {
    for (const m of p.items) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

interface RickBotPanelProps {
  onSelectAuthor?: (authorId: string, authorName: string) => void;
  /** Alça de reordenar coluna (renderizada no header pela RadarScreen). */
  dragHandle?: React.ReactNode;
}

/**
 * Coluna 1 (esquerda) — feed FIXO do usuário Rick Bot (`Rick#9725`), buscado por
 * `authorTag` no backend e paginado (chat: novas embaixo). Header com nome +
 * contagem total. Independe da rail de fontes (que controla o feed central).
 */
export function RickBotPanel({ onSelectAuthor, dragHandle }: RickBotPanelProps) {
  const query = useInfiniteQuery({
    queryKey: RICK_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      // O cabeçalho mostra o total: COUNT só na 1ª página, não a cada rolagem.
      getFeedMessages({
        authorTag: RICK_BOT_TAG,
        before: pageParam ?? undefined,
        limit: 20,
        withTotal: pageParam === null,
      }),
    initialPageParam: null as FeedPageParam,
    getNextPageParam: nextFeedPage,
  });

  const items = useMemo(() => flattenUnique(query.data?.pages), [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  // Mesmo critério do Feed principal: sem oferta enquanto o plano carrega.
  const { isPro, isLoading: planLoading } = usePlan();
  const freeEmpty = !isPro && !planLoading;

  return (
    <aside className="flex max-h-[85dvh] min-h-0 flex-col lg:max-h-none lg:h-full">
      {/* Header: nome do Rick + contagem total */}
      <div className="flex h-[46px] shrink-0 items-center justify-between gap-2 border-b border-gray-6 bg-gray-2 px-3">
        <div className="flex min-w-0 items-center gap-1">
          {dragHandle}
          <h2 className="min-w-0 truncate text-base font-semibold text-gray-12">Rick Bot</h2>
        </div>
        {total > 0 && <CountBadge>{fmtCount(total)}</CountBadge>}
      </div>

      {query.isLoading ? (
        <SkeletonGroup className="flex flex-col flex-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <MessageSkeleton key={i} />
          ))}
        </SkeletonGroup>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-3 py-16 text-center">
          <div className="flex flex-col items-center gap-2 px-3">
            <p className="text-sm font-semibold text-gray-12">Nothing from Rick yet</p>
            <p className="max-w-xs text-xs text-gray-11">
              {freeEmpty
                ? "On Free, Rick only shows up from the groups open to Free."
                : "Rick Bot captures show up here in real time."}
            </p>
          </div>
          {/* Coluna estreita: o bloco de upgrade empilha em vez de ficar lado a lado. */}
          {freeEmpty && (
            <ProLock
              title="Rick on every group"
              className="w-full flex-col items-stretch text-left"
            />
          )}
        </div>
      ) : (
        <ChatMessageList
          messages={items}
          hasOlder={query.hasNextPage}
          isLoadingOlder={query.isFetchingNextPage}
          loadOlder={query.fetchNextPage}
          onSelectAuthor={onSelectAuthor}
          surface="list"
          compact
          nameAccent
        />
      )}
    </aside>
  );
}
