"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { RANKING_KEY, getRankingOverview, getRankingStandings } from "@/lib/api/ranking";

/** O cron recalcula a cada 5 min — atualizar a tela a cada minuto basta. */
const REFRESH_MS = 60_000;

/** Primeira página da tabela (posições 4–13 no Figma); "Load 20 more" depois. */
export const FIRST_PAGE = 10;
export const NEXT_PAGE = 20;
/** Sem busca, a tabela começa depois do pódio. */
export const PODIUM_SIZE = 3;

export function useRankingOverview() {
  return useQuery({
    queryKey: [...RANKING_KEY, "overview"],
    queryFn: getRankingOverview,
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
  });
}

/**
 * Classificação paginada por offset. Sem busca, começa na 4ª posição (o pódio
 * já mostra o top 3); com busca, procura em todos — inclusive o pódio.
 */
export function useRankingStandings(q: string, enabled: boolean) {
  const start = q ? 0 : PODIUM_SIZE;
  return useInfiniteQuery({
    queryKey: [...RANKING_KEY, "standings", q],
    queryFn: ({ pageParam }) =>
      getRankingStandings({
        offset: pageParam,
        limit: pageParam === start ? FIRST_PAGE : NEXT_PAGE,
        q: q || undefined,
      }),
    initialPageParam: start,
    getNextPageParam: (last, _pages, lastParam) => {
      const next = lastParam + last.rows.length;
      return last.rows.length > 0 && next < last.total ? next : undefined;
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}
