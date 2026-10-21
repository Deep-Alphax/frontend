"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  COPY_TRADE_KEY,
  copyAction,
  createCopy,
  getCopiers,
  getCopyFeed,
  getCopyOverview,
  getKolCopy,
  getW1,
  updateCopy,
  type CopyConfig,
} from "@/lib/api/copyTrade";

/*
 * Copies do usuário (execução). Leitura com atualização curta — o executor
 * age em segundos; mutações invalidam tudo que mostra o copy (esquerda, feed,
 * 3ª coluna, copiadores e cards com "N copiam").
 */

const ME_KEY = [...COPY_TRADE_KEY, "me"] as const;
const W1_KEY = [...COPY_TRADE_KEY, "w1"] as const;
const LIVE_MS = 15_000;

export function useCopyOverview(enabled: boolean) {
  return useQuery({
    queryKey: [...ME_KEY, "overview"],
    queryFn: getCopyOverview,
    enabled,
    staleTime: 10_000,
    refetchInterval: LIVE_MS,
  });
}

/** "Agora nos seus copies": 10 por página (Figma "tabela - ao vivo"). */
export function useCopyFeed(page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...ME_KEY, "feed", page],
    queryFn: () => getCopyFeed(page),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    // Só a 1ª página se atualiza sozinha: quem está na 3 não vê a lista andar.
    refetchInterval: page === 1 ? LIVE_MS : false,
  });
}

export function useKolCopy(kolId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: [...ME_KEY, "kol", kolId],
    queryFn: () => getKolCopy(kolId!),
    enabled: enabled && !!kolId,
    staleTime: 10_000,
    refetchInterval: LIVE_MS,
  });
}

export function useCopiers(kolId: string | null, page: number, enabled: boolean) {
  return useQuery({
    queryKey: [...ME_KEY, "copiers", kolId, page],
    queryFn: () => getCopiers(kolId!, page),
    enabled: enabled && !!kolId,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useW1(enabled: boolean) {
  return useQuery({ queryKey: W1_KEY, queryFn: getW1, enabled, staleTime: 10_000, refetchInterval: LIVE_MS });
}

/** Criar, ajustar, pausar, retomar e parar. */
export function useCopyMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: COPY_TRADE_KEY });
  return {
    create: useMutation({
      mutationFn: (body: { kolId?: string; address?: string; config: CopyConfig }) => createCopy(body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (p: { copyId: string; config: CopyConfig }) => updateCopy(p.copyId, p.config),
      onSuccess: refresh,
    }),
    action: useMutation({
      mutationFn: (p: { copyId: string; action: "pause" | "resume" | "end" }) => copyAction(p.copyId, p.action),
      onSuccess: refresh,
    }),
  };
}

export function useInvalidateW1() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: W1_KEY });
}
