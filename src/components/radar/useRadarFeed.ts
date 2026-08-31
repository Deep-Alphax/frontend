"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  getFeedGroups,
  getFeedMessages,
  type CapturedMessage,
  type FavoriteAuthor,
  type FeedPage,
} from "@/lib/api/feed";
import { getSocket } from "@/lib/realtime/socket";
import {
  FAVORITES_KEY,
  FAVORITE_MESSAGES_KEY,
} from "@/components/radar/useFavorites";

const PAGE_LIMIT = 20;
/** Chave do feed central por canal ativo + termo de busca (`null`/"" = todos). */
const feedKey = (channelId: string | null, search: string) =>
  ["radar-feed", channelId, search] as const;
const GROUPS_KEY = ["radar-groups"] as const;

/** Subgrupo (canal do Discord) dentro de um grupo/servidor. */
export interface RadarSubgroup {
  /** Identidade estável do canal — usada p/ filtrar o feed no backend. */
  channelId: string;
  /** Rótulo do canal (`#nome`), com fallback quando o nome é desconhecido. */
  name: string;
  count: number;
}

/**
 * Fonte plana p/ a rail: um CANAL monitorado (não o servidor). Servidores com
 * vários canais viram várias fontes — cada canal é uma fonte distinta.
 */
export interface RadarSource {
  /** Identidade estável do canal — filtra o feed central por channelId. */
  channelId: string;
  /** Rótulo do canal (`#nome`). */
  name: string;
  /** Servidor de origem (para tooltip/cor). */
  guildName: string | null;
  count: number;
}

/**
 * Seleção da rail de Fontes:
 * - `null` → "Todas as fontes" (feed central sem filtro).
 * - guild → todas as capturas do servidor (por `guildName`).
 * - channel → um canal específico (por `channelId`).
 */
export type SourceSelection =
  | null
  | { kind: "guild"; guild: string | null }
  | { kind: "channel"; channelId: string };

/** Grupo (servidor Discord) — árvore agregada no backend (contagens totais). */
export interface RadarGroup {
  /** Chave estável do grupo (guildName). `null` = mensagens sem grupo. */
  key: string | null;
  name: string;
  /** URL do ícone do servidor (CDN do Discord); null = usa a inicial. */
  iconUrl: string | null;
  count: number;
  /** Canais desse grupo (subgrupos), ordenados por contagem desc. */
  subgroups: RadarSubgroup[];
}

export interface RadarFeed {
  messages: CapturedMessage[];
  groups: RadarGroup[];
  /** Total de mensagens no backend (independe do que já carregou). */
  total: number;
  /** Quantas já foram carregadas nesta sessão de scroll. */
  loaded: number;
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  loadMore: () => void;
  /** IDs que chegaram em tempo real (socket) — usados p/ animar a entrada. */
  newIds: Set<string>;
}

/** Teto do conjunto de IDs "novos" (evita crescer sem limite numa sessão longa). */
const MAX_NEW_IDS = 300;

const GROUP_FALLBACK = "Sem grupo";

/**
 * Fonte única de dados da tela de Radar. Acumula as páginas do feed (infinite
 * scroll) e injeta as capturas em tempo real (socket `feed:new`) no topo.
 *
 * A árvore de grupos→canais vem de um endpoint agregado (`getFeedGroups`),
 * portanto reflete a estrutura REAL do servidor (todos os canais e contagens
 * totais), independente do que já foi rolado. Quando um canal está selecionado,
 * o feed central é buscado já filtrado por `channelId` no backend — mostra todas
 * as mensagens do canal, não só as do pool carregado.
 *
 * Performance: uma query de feed por canal ativo (cache no react-query) + uma
 * query de grupos leve (agregação no banco), ambas sem polling — o realtime
 * chega por WebSocket.
 */
export function useRadarFeed(
  activeChannelId: string | null = null,
  search = "",
): RadarFeed {
  const queryClient = useQueryClient();
  // IDs chegados em tempo real (para animar a entrada). Estado imutável: cada
  // captura gera um novo Set — barato (teto MAX_NEW_IDS) e re-renderiza a lista.
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

  const query = useInfiniteQuery({
    queryKey: feedKey(activeChannelId, search),
    queryFn: ({ pageParam }) =>
      getFeedMessages({
        page: pageParam,
        limit: PAGE_LIMIT,
        channelId: activeChannelId ?? undefined,
        search: search.trim() || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });

  // Árvore grupos→canais (contagens totais, agregadas no backend).
  const groupsQuery = useQuery({
    queryKey: GROUPS_KEY,
    queryFn: getFeedGroups,
    staleTime: 30_000,
  });

  // Tempo real: novas capturas entram no topo da primeira página (sem duplicar).
  // Sem polling — só reage ao push do backend, igual ao feed do admin.
  useEffect(() => {
    const socket = getSocket();

    // Prepend imutável numa query infinita (dedup por id). Só atua se a query já
    // existe no cache — não cria entradas fantasma.
    const prependInfinite = (key: readonly unknown[], msg: CapturedMessage): boolean => {
      if (!queryClient.getQueryData(key)) return false;
      let didPrepend = false;
      queryClient.setQueryData<InfiniteData<FeedPage, number>>(key, (prev) => {
        if (!prev || prev.pages.length === 0) return prev;
        if (prev.pages.some((p) => p.items.some((m) => m.id === msg.id))) return prev;
        didPrepend = true;
        const [first, ...rest] = prev.pages;
        return {
          ...prev,
          pages: [
            { ...first, items: [msg, ...first.items], total: first.total + 1 },
            ...rest,
          ],
        };
      });
      return didPrepend;
    };

    const onNew = (msg: CapturedMessage) => {
      // Feed central "todos" + feed do canal correspondente (o que estiver em cache).
      // Só nos feeds SEM busca ("" ); feeds de busca são snapshots do termo.
      const prependedAll = prependInfinite(feedKey(null, ""), msg);
      const prependedChannel = prependInfinite(feedKey(msg.channelId, ""), msg);
      if (prependedAll || prependedChannel) {
        // Marca como "novo" p/ a animação de entrada; poda o conjunto se crescer.
        setNewIds((prev) => {
          const next = new Set(prev);
          next.add(msg.id);
          if (next.size > MAX_NEW_IDS) next.delete(next.values().next().value as string);
          return next;
        });
      }

      // "Seus favoritos" é um feed de quem você SEGUE → tempo real também.
      // Identidade = authorTag (a chave de follow guardada no favorito). O
      // `followed` é obrigatório: a mesma lista traz autores que o usuário só
      // personalizou, e esses NÃO entram no feed (o backend também os exclui).
      const favs = queryClient.getQueryData<FavoriteAuthor[]>(FAVORITES_KEY);
      if (msg.authorTag && favs?.some((f) => f.authorId === msg.authorTag && f.followed)) {
        prependInfinite(FAVORITE_MESSAGES_KEY, msg);
      }

      // Perfil aberto desse autor (se estiver no cache) → tempo real também.
      if (msg.authorTag) {
        prependInfinite(["feed-author", msg.authorTag], msg);
      }
    };
    socket.on("feed:new", onNew);
    socket.connect();
    return () => {
      socket.off("feed:new", onNew);
    };
  }, [queryClient]);

  // Deduplica por id: com prepend em tempo real, a paginação por offset pode
  // devolver um item que já está numa página anterior (mesma captura em 2 páginas).
  const messages = useMemo(() => {
    const flat = query.data?.pages.flatMap((p) => p.items) ?? [];
    const seen = new Set<string>();
    const out: CapturedMessage[] = [];
    for (const m of flat) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [query.data]);

  const groups = useMemo<RadarGroup[]>(
    () =>
      (groupsQuery.data ?? []).map((g) => ({
        key: g.guildName ?? null,
        name: g.guildName ?? GROUP_FALLBACK,
        iconUrl: g.guildIconUrl ?? null,
        count: g.count,
        subgroups: g.channels.map((c) => ({
          channelId: c.channelId,
          name: c.channelName ? `#${c.channelName}` : "#canal",
          count: c.count,
        })),
      })),
    [groupsQuery.data],
  );

  // Total geral = soma das contagens dos grupos (todas as mensagens). Fallback
  // no total da página do feed enquanto a árvore ainda não carregou.
  const total = useMemo(() => {
    if (groupsQuery.data?.length)
      return groupsQuery.data.reduce((sum, g) => sum + g.count, 0);
    return query.data?.pages[0]?.total ?? 0;
  }, [groupsQuery.data, query.data]);

  return {
    messages,
    groups,
    total,
    loaded: messages.length,
    hasMore: query.hasNextPage,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
    newIds,
  };
}
