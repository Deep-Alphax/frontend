"use client";

import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Star } from "lucide-react";

import {
  getAuthorStats,
  getFeedMessages,
  type CapturedMessage,
} from "@/lib/api/feed";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useFavorites } from "@/components/radar/useFavorites";
import { VirtualMessageList } from "@/components/radar/VirtualMessageList";

interface ProfilePanelProps {
  /** Snowflake do autor selecionado. */
  authorId: string;
  /** Nome de exibição (última tag vista). */
  authorName: string;
  /** Volta para o painel de favoritos. */
  onBack: () => void;
}

/** Idade compacta desde `iso`: "9m" · "3h" · "5d" · "2mes". */
function compactAge(iso: string | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.max(0, Math.floor(diff / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return `${Math.floor(d / 30)}mes`;
}

/** Caixa de estatística (valor + rótulo). */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded border border-gray-6 p-3">
      <span className="text-sm font-semibold text-gray-12">{value}</span>
      <span className="text-xs text-gray-11">{label}</span>
    </div>
  );
}

/** Achata as páginas e deduplica por id. */
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

/**
 * "Detalhes do perfil" (node Figma 491:7664) — abre no lugar dos favoritos ao
 * clicar numa mensagem. Cabeçalho + stats + seguir + posts do autor (buscados
 * por `authorId`, paginados e virtualizados).
 */
export function ProfilePanel({ authorId, authorName, onBack }: ProfilePanelProps) {
  const { isFavorite, toggle, isMutating } = useFavorites();
  const following = isFavorite(authorId);

  const query = useInfiniteQuery({
    queryKey: ["feed-author", authorId],
    queryFn: ({ pageParam }) =>
      getFeedMessages({ authorId, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const messages = useMemo(() => flattenUnique(query.data?.pages), [query.data]);
  const group = messages[0]?.guildName ?? null;

  // Stats exatos do backend (mensagens, tokens distintos, primeira captura).
  const statsQuery = useQuery({
    queryKey: ["author-stats", authorId],
    queryFn: () => getAuthorStats(authorId),
  });

  const stats = {
    messages: (statsQuery.data?.messages ?? 0).toLocaleString("pt-BR"),
    tokens: String(statsQuery.data?.tokens ?? 0),
    radar: statsQuery.data ? compactAge(statsQuery.data.firstSeenAt ?? undefined) : "—",
  };

  return (
    <aside className="flex max-h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2">
      {/* Header */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-gray-6 px-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar aos favoritos"
          className="flex size-6 items-center justify-center rounded-full border border-gray-6 bg-gray-3 text-gray-11 transition-colors hover:text-gray-12"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
        </button>
        <h2 className="text-base font-semibold text-gray-12">Detalhes do perfil</h2>
      </div>

      {/* Bloco do usuário */}
      <div className="flex shrink-0 flex-col border-b border-gray-6">
        <div className="flex items-center gap-2 p-3">
          <Avatar name={authorName} className="size-7" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-12">{authorName}</p>
            {group && <p className="truncate text-sm text-gray-11">{group}</p>}
          </div>
        </div>

        <div className="flex items-stretch gap-1 px-3 py-1">
          <Stat value={stats.messages} label="Mensagens" />
          <Stat value={stats.tokens} label="tokens" />
          <Stat value={stats.radar} label="no radar" />
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={() => toggle(authorId, authorName)}
            disabled={isMutating}
            aria-pressed={following}
            className={cn(
              "flex h-9 w-full items-center justify-center gap-2 rounded-lg px-8 text-sm font-semibold transition-colors disabled:opacity-60",
              following
                ? "border border-gray-6 bg-gray-2 text-gray-12 hover:bg-gray-3"
                : "bg-principal-9 text-gray-1 hover:bg-principal-10",
            )}
          >
            {following ? (
              <>
                <Check className="size-4" strokeWidth={2.5} />
                Seguindo
              </>
            ) : (
              <>
                <Star className="size-4" strokeWidth={2} />
                Seguir
              </>
            )}
          </button>
        </div>
      </div>

      {/* Posts */}
      <p className="shrink-0 px-4 pt-3 text-sm font-semibold text-gray-12">Posts</p>
      {query.isLoading ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-gray-6 bg-gray-1" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <p className="p-4 text-sm text-gray-11">Nenhuma mensagem recente.</p>
      ) : (
        <VirtualMessageList
          items={messages}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={query.fetchNextPage}
        />
      )}
    </aside>
  );
}
