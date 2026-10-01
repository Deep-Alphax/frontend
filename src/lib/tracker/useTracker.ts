"use client";

import { useEffect } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  TRACKER_KEY,
  getConfluence,
  getDiscovery,
  getMultiBuys,
  getNetFlows,
  getTopSources,
  getTrackerFeed,
  getTrackerFilters,
  setFollow,
  type DiscoveryItem,
  type SourcePeriod,
  type TrackerFeedFilters,
} from "@/lib/api/tracker";
import { getSocket } from "@/lib/realtime/socket";

/*
 * Dados do Tracker. Tudo é global no servidor (cache curto no Redis), então o
 * tempo real é só um AVISO pelo socket (`tracker:update`, no máx. 1/s): o
 * front invalida as queries ativas e o react-query rebusca. Sem socket (rede
 * ruim), o `refetchInterval` cobre — mais lento, nunca parado.
 */

const FALLBACK_POLL_MS = 30_000;

export function useTrackerFeed(filters: TrackerFeedFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [...TRACKER_KEY, "feed", filters],
    queryFn: ({ pageParam }) => getTrackerFeed(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Trocar filtro não "some" com a lista (lição de 28/09).
    placeholderData: keepPreviousData,
    refetchInterval: FALLBACK_POLL_MS,
    enabled,
  });
}

export function useConfluence(enabled: boolean) {
  return useQuery({
    queryKey: [...TRACKER_KEY, "confluence"],
    queryFn: getConfluence,
    refetchInterval: FALLBACK_POLL_MS,
    enabled,
  });
}

export function useMultiBuys(enabled: boolean) {
  return useQuery({ queryKey: [...TRACKER_KEY, "multi-buys"], queryFn: getMultiBuys, enabled });
}

export function useNetFlows(enabled: boolean) {
  return useQuery({ queryKey: [...TRACKER_KEY, "net-flows"], queryFn: getNetFlows, enabled });
}

export function useTopSources(period: SourcePeriod, enabled: boolean) {
  return useQuery({
    queryKey: [...TRACKER_KEY, "sources", period],
    queryFn: () => getTopSources(period),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  });
}

export function useDiscovery(enabled: boolean) {
  return useQuery({
    queryKey: [...TRACKER_KEY, "discovery"],
    queryFn: getDiscovery,
    staleTime: 60_000,
    enabled,
  });
}

export function useTrackerFilters(enabled: boolean) {
  return useQuery({
    queryKey: [...TRACKER_KEY, "filters"],
    queryFn: getTrackerFilters,
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Seguir/deixar de seguir com atualização otimista (volta atrás se falhar). */
export function useFollowWallet() {
  const qc = useQueryClient();
  const key = [...TRACKER_KEY, "discovery"];
  return useMutation({
    mutationFn: (w: DiscoveryItem) => setFollow(w.chain, w.address, !w.following),
    onMutate: async (w) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DiscoveryItem[]>(key);
      qc.setQueryData<DiscoveryItem[]>(key, (list) =>
        list?.map((x) =>
          x.chain === w.chain && x.address === w.address ? { ...x, following: !w.following } : x,
        ),
      );
      return { prev };
    },
    onError: (_e, _w, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

/** Aviso do socket → rebusca o feed e os painéis de tempo real ativos. */
export function useTrackerRealtime(enabled: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    const onUpdate = () => {
      qc.invalidateQueries({ queryKey: [...TRACKER_KEY, "feed"] });
      qc.invalidateQueries({ queryKey: [...TRACKER_KEY, "confluence"] });
      qc.invalidateQueries({ queryKey: [...TRACKER_KEY, "multi-buys"] });
      qc.invalidateQueries({ queryKey: [...TRACKER_KEY, "net-flows"] });
    };
    socket.on("tracker:update", onUpdate);
    socket.connect();
    return () => {
      socket.off("tracker:update", onUpdate);
    };
  }, [enabled, qc]);
}
