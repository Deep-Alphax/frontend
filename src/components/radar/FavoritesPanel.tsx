"use client";

import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import {
  getFavoriteMessages,
  nextFeedPage,
  type CapturedMessage,
  type FeedPageParam,
} from "@/lib/api/feed";
import {
  FAVORITE_MESSAGES_KEY,
  useFavorites,
} from "@/components/radar/useFavorites";
import { ChatMessageList } from "@/components/radar/ChatMessageList";
import { MessageSkeleton, SkeletonGroup } from "@/components/ui/Skeleton";

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
    queryFn: ({ pageParam }) =>
      getFavoriteMessages({ before: pageParam ?? undefined, limit: 20 }),
    initialPageParam: null as FeedPageParam,
    getNextPageParam: nextFeedPage,
  });

  const items = useMemo(() => flattenUnique(query.data?.pages), [query.data]);
  const hasItems = items.length > 0;

  return (
    <aside className="flex max-h-[85dvh] min-h-0 flex-col lg:max-h-none lg:h-full">
      {/* Header */}
      <div className="flex h-[46px] shrink-0 items-center justify-between gap-2 bg-gray-2 border-b border-gray-6 px-3">
        <div className="flex min-w-0 items-center gap-1">
          {dragHandle}
          <h2 className="text-base font-semibold text-gray-12">Your favorites</h2>
        </div>
        {count > 0 && <CountBadge>{count}</CountBadge>}
      </div>

      {query.isLoading ? (
        <SkeletonGroup className="flex flex-col">
          {Array.from({ length: 4 }).map((_, i) => (
            <MessageSkeleton key={i} />
          ))}
        </SkeletonGroup>
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
            <p className="text-base font-semibold text-gray-12">Nothing here yet...</p>
            <p className="text-sm leading-snug text-gray-11">
              Follow the people you watch closely and their messages
              show up in this feed only
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
