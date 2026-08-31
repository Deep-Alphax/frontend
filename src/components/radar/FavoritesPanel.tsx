"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { getFavoriteMessages, type CapturedMessage } from "@/lib/api/feed";
import {
  FAVORITE_MESSAGES_KEY,
  useFavorites,
} from "@/components/radar/useFavorites";
import { ChatMessageList } from "@/components/radar/ChatMessageList";

/** Badge de contagem do header (tokens do DS: principal 3/8/11). */
function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-xl border border-principal-8 bg-principal-3 px-2 py-1.5 text-sm leading-none tabular-nums text-principal-11">
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

interface FavoritesPanelProps {
  /** Abre o perfil ao clicar em uma mensagem de favorito. */
  onSelectAuthor?: (authorId: string, authorName: string) => void;
  /** Alça de reordenar coluna (renderizada no header pela RadarScreen). */
  dragHandle?: React.ReactNode;
}

/**
 * Coluna direita: usuários favoritos (node Figma 492:8263). Feed dos autores
 * seguidos, server-side + paginado, virtualizado (escala sem custo). Badge = nº
 * de seguidos. Sem favoritos → empty state.
 */
export function FavoritesPanel({ onSelectAuthor, dragHandle }: FavoritesPanelProps) {
  const { count } = useFavorites();

  const query = useInfiniteQuery({
    queryKey: FAVORITE_MESSAGES_KEY,
    queryFn: ({ pageParam }) => getFavoriteMessages({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const items = useMemo(() => flattenUnique(query.data?.pages), [query.data]);
  const hasItems = items.length > 0;

  return (
    <aside className="flex max-h-[85dvh] min-h-0 flex-col lg:max-h-none lg:h-full">
      {/* Header */}
      <div className="flex h-[46px] shrink-0 items-center justify-between gap-2 bg-gray-2 border-b border-gray-6 px-3">
        <div className="flex min-w-0 items-center gap-1">
          {dragHandle}
          <h2 className="text-base font-semibold text-gray-12">Seus favoritos</h2>
        </div>
        {count > 0 && <CountBadge>{count}</CountBadge>}
      </div>

      {query.isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-gray-6 bg-gray-1" />
          ))}
        </div>
      ) : hasItems ? (
        <ChatMessageList
          messages={items}
          hasOlder={query.hasNextPage}
          isLoadingOlder={query.isFetchingNextPage}
          loadOlder={query.fetchNextPage}
          onSelectAuthor={onSelectAuthor}
          surface="list"
          compact
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-7 px-4 py-[52px] text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/favorites-star-3d.png"
            alt=""
            width={76}
            height={80}
            className="h-20 w-[76px] object-contain"
          />
          <div className="flex flex-col items-center gap-4">
            <p className="text-base font-semibold text-gray-12">Nada aqui ainda...</p>
            <p className="text-sm leading-snug text-gray-11">
              Siga quem você acompanha de perto e as mensagens dessas pessoas
              aparecem só neste feed
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
