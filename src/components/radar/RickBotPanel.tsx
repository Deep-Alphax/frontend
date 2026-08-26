"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { getFeedMessages, type CapturedMessage } from "@/lib/api/feed";
import { ChatMessageList } from "@/components/radar/ChatMessageList";
import { fmtCount } from "@/components/radar/groupAvatar";

/**
 * Usuário fixo da coluna esquerda ("Rick Bot"). Ajuste aqui se a identidade mudar.
 * A chave de query espelha a do perfil (`["feed-author", tag]`), então o realtime
 * (`feed:new` em useRadarFeed) já faz prepend das capturas do Rick sem código extra.
 */
const RICK_BOT_TAG = "Rick#9725";
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
}

/**
 * Coluna 1 (esquerda) — feed FIXO do usuário Rick Bot (`Rick#9725`), buscado por
 * `authorTag` no backend e paginado (chat: novas embaixo). Header com nome +
 * contagem total. Independe da rail de fontes (que controla o feed central).
 */
export function RickBotPanel({ onSelectAuthor }: RickBotPanelProps) {
  const query = useInfiniteQuery({
    queryKey: RICK_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      getFeedMessages({ authorTag: RICK_BOT_TAG, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const items = useMemo(() => flattenUnique(query.data?.pages), [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  return (
    <aside className="flex max-h-[85dvh] min-h-0 flex-col border-b border-gray-6  lg:max-h-none lg:h-full lg:border-b-0 lg:border-r">
      {/* Header: nome do Rick + contagem total */}
      <div className="flex h-[46px] shrink-0 items-center justify-between gap-2 border-b border-gray-6 bg-gray-2 px-3">
        <h2 className="min-w-0 truncate text-base font-semibold text-gray-12">Rick Bot</h2>
        {total > 0 && <CountBadge>{fmtCount(total)}</CountBadge>}
      </div>

      {query.isLoading ? (
        <div className="flex flex-1 flex-col gap-3 p-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-gray-6 bg-gray-2" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-gray-12">Nada do Rick ainda</p>
          <p className="max-w-xs text-xs text-gray-11">
            As capturas do Rick Bot aparecem aqui em tempo real.
          </p>
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
          showCa
        />
      )}
    </aside>
  );
}
