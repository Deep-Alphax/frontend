"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import {
  TRACKER_KEY,
  getConfluence,
  getDiscovery,
  getMultiBuys,
  getNetFlows,
  getTokenDetail,
  getTopSources,
  getTrackerFeed,
  getTrackerFilters,
  setFollow,
  type DiscoveryItem,
  type SourcePeriod,
  type TrackerFeedFilters,
  type TrackerFeedPage,
  type TokenRef,
} from "@/lib/api/tracker";
import { getSocket } from "@/lib/realtime/socket";

/*
 * Dados do Tracker. Tudo é global no servidor (cache curto no Redis), então o
 * tempo real é só um AVISO pelo socket (`tracker:update`, no máx. 1/s): o
 * front invalida as queries ativas e o react-query rebusca. Sem socket (rede
 * ruim), o `refetchInterval` cobre — mais lento, nunca parado.
 */

const FALLBACK_POLL_MS = 30_000;

const feedKey = (filters: TrackerFeedFilters) => [...TRACKER_KEY, "feed", filters] as const;

export function useTrackerFeed(filters: TrackerFeedFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: feedKey(filters),
    queryFn: ({ pageParam }) => getTrackerFeed(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Trocar filtro não "some" com a lista (lição de 28/09).
    placeholderData: keepPreviousData,
    // SEM refetchInterval: numa query infinita ele rebusca TODAS as páginas
    // carregadas — com o usuário 10 páginas abaixo, eram 10 requisições e a
    // lista inteira re-renderizando a cada ciclo. Atualização é pelo socket,
    // só da 1ª página (`refreshFeedTop`).
    staleTime: 15_000,
    enabled,
  });
}

/**
 * Recarrega só o TOPO do feed: corta o cache para a 1ª página antes de
 * invalidar, então o react-query faz 1 requisição (não uma por página
 * carregada). As páginas de baixo voltam pela rolagem, se o usuário descer.
 */
export function refreshFeedTop(qc: QueryClient, filters: TrackerFeedFilters): void {
  const key = feedKey(filters);
  qc.setQueryData<InfiniteData<TrackerFeedPage, string | null>>(key, (d) =>
    d && d.pages.length > 1 ? { pages: d.pages.slice(0, 1), pageParams: d.pageParams.slice(0, 1) } : d,
  );
  void qc.invalidateQueries({ queryKey: key, exact: true });
}

/** Throttle simples (borda inicial + final): no máx. 1 chamada a cada `ms`. */
function useThrottled(fn: () => void, ms: number): () => void {
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return useCallback(() => {
    const wait = last.current + ms - Date.now();
    if (wait <= 0) {
      last.current = Date.now();
      fnRef.current();
      return;
    }
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      last.current = Date.now();
      fnRef.current();
    }, wait);
  }, [ms]);
}

/** Assina o aviso `tracker:update` do socket. */
function useTrackerSocket(enabled: boolean, onUpdate: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    socket.on("tracker:update", onUpdate);
    socket.connect();
    return () => {
      socket.off("tracker:update", onUpdate);
    };
  }, [enabled, onUpdate]);
}

/** Feed: avisa a tela (no máx. a cada 3s) — ela decide se recarrega o topo. */
export function useFeedRealtime(enabled: boolean, onUpdate: () => void): void {
  useTrackerSocket(enabled, useThrottled(onUpdate, 3_000));
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

/**
 * Painéis (Confluence, Multi Buys, Net Flows): no máx. a cada 10s — o
 * servidor já os cacheia por 15s, rebuscar mais rápido só gastaria rede.
 * O feed NÃO entra aqui (`useFeedRealtime`).
 */
export function useTrackerRealtime(enabled: boolean): void {
  const qc = useQueryClient();
  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: [...TRACKER_KEY, "confluence"] });
    void qc.invalidateQueries({ queryKey: [...TRACKER_KEY, "multi-buys"] });
    void qc.invalidateQueries({ queryKey: [...TRACKER_KEY, "net-flows"] });
  }, [qc]);
  useTrackerSocket(enabled, useThrottled(refresh, 10_000));
}

/** 4xx não melhora tentando de novo (ex.: 403 do FREE, 400 de mint inválido). */
const isClientError = (error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return typeof status === "number" && status >= 400 && status < 500;
};

/**
 * Drawer do token. O servidor monta o detalhe com cache de 10s e a série do
 * gráfico anda 1 ponto por minuto: 15s de intervalo deixa o drawer "vivo" sem
 * martelar. `isPending` (não `isLoading`) decide o skeleton — lição de 22/09.
 */
export function useTokenDetail(ref: Pick<TokenRef, "chain" | "mint"> | null) {
  return useQuery({
    queryKey: [...TRACKER_KEY, "token", ref?.chain, ref?.mint],
    queryFn: () => getTokenDetail(ref!.chain, ref!.mint),
    enabled: !!ref,
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: (count, error) => count < 1 && !isClientError(error),
  });
}
