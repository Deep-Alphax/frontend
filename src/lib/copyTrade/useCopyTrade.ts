"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import {
  COPY_TRADE_KEY,
  getCopyKol,
  getCopyKols,
  getCopyTradeHome,
  type CopyTradeSort,
} from "@/lib/api/copyTrade";

/** O snapshot do backend é refeito a cada 5 min — 1 min de atualização basta. */
const REFRESH_MS = 60_000;
/** Grade "All"/filtros: 24 cards por página (múltiplo de 2, 3 e 4 colunas). */
export const KOLS_PAGE = 24;

export function useCopyTradeHome(enabled: boolean) {
  return useQuery({
    queryKey: [...COPY_TRADE_KEY, "home"],
    queryFn: getCopyTradeHome,
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
    enabled,
  });
}

/**
 * Grade paginada por offset ("Load more"). SEM refetchInterval: numa query
 * infinita ele rebuscaria todas as páginas carregadas (lição do Tracker).
 */
export function useCopyKols(sort: CopyTradeSort, q: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...COPY_TRADE_KEY, "kols", sort, q],
    queryFn: ({ pageParam }) => getCopyKols({ sort, q: q || undefined, offset: pageParam, limit: KOLS_PAGE }),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, lastParam) => {
      const next = lastParam + last.items.length;
      return last.items.length > 0 && next < last.total ? next : undefined;
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  });
}

export function useCopyKol(kolId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...COPY_TRADE_KEY, "kol", kolId],
    queryFn: () => getCopyKol(kolId!),
    enabled: enabled && !!kolId,
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
  });
}
