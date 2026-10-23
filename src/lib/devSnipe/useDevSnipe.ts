"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  SNIPE_KEY,
  createSnipe,
  getLaunches,
  getSnipeOverview,
  getTrendingDevs,
  resolveDev,
  snipeAction,
  updateSnipe,
  type SnipeConfig,
} from "@/lib/api/devSnipe";

/*
 * Dev Snipe (execução). Mesmo padrão de `copyTrade/useCopies`: leitura com
 * atualização curta, `keepPreviousData` na paginação e mutações que
 * invalidam tudo sob `SNIPE_KEY` (esquerda, contagem da aba, tabela).
 */

const ME_KEY = [...SNIPE_KEY, "me"] as const;
const LIVE_MS = 15_000;
export const LAUNCHES_PAGE = 10;

/** 4xx não melhora tentando de novo (403 do FREE, 400 de endereço inválido). */
const retryUnless4xx = (count: number, error: unknown): boolean => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return count < 1 && !(typeof status === "number" && status >= 400 && status < 500);
};

/**
 * Snipes do usuário. `live` = aba Dev Snipe aberta: só ela se atualiza
 * sozinha — na aba Wallet Copy o dado serve só para a contagem da aba.
 */
export function useSnipeOverview(enabled: boolean, live = true) {
  return useQuery({
    queryKey: [...ME_KEY, "overview"],
    queryFn: getSnipeOverview,
    enabled,
    staleTime: 10_000,
    refetchInterval: live ? LIVE_MS : false,
    retry: retryUnless4xx,
  });
}

/** "Trending devs": muda devagar (taxa de migração de 30 dias). */
export function useTrendingDevs(enabled: boolean) {
  return useQuery({
    queryKey: [...SNIPE_KEY, "devs"],
    queryFn: getTrendingDevs,
    enabled,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: retryUnless4xx,
  });
}

/** "Recent launches": 10 por página; só a 1ª se atualiza sozinha. */
export function useLaunches(page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...SNIPE_KEY, "launches", page],
    queryFn: () => getLaunches(page, LAUNCHES_PAGE),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: page === 1 ? 30_000 : false,
    retry: retryUnless4xx,
  });
}

/** Prévia do dev colado no drawer — só para endereço que já passou na regex. */
export function useResolveDev(address: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...SNIPE_KEY, "resolve", address],
    queryFn: () => resolveDev(address!),
    enabled: enabled && !!address,
    staleTime: 60_000,
    retry: false,
  });
}

/** Criar, ajustar, pausar, retomar e encerrar. */
export function useSnipeMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: SNIPE_KEY });
  return {
    create: useMutation({
      mutationFn: (body: { dev: string; config: SnipeConfig }) => createSnipe(body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (p: { id: string; config: SnipeConfig }) => updateSnipe(p.id, p.config),
      onSuccess: refresh,
    }),
    action: useMutation({
      mutationFn: (p: { id: string; action: "pause" | "resume" | "end" }) => snipeAction(p.id, p.action),
      onSuccess: refresh,
    }),
  };
}
