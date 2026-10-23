"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import {
  createDeposit,
  DEPOSITS_KEY,
  getDeposit,
  getDepositOptions,
  getDepositQuote,
  listDeposits,
  type DepositView,
} from "@/lib/api/deposits";
import type { BackendChain } from "@/lib/api/wallets";
import { isTerminal, pollInterval } from "@/lib/deposits/format";

/*
 * Estado de servidor do depósito via Pix (TanStack Query). Todas as chaves
 * nascem de `DEPOSITS_KEY`, então invalidar ["deposits"] refaz tudo.
 *
 * Quem decide se o Pix caiu e se a cripto chegou é o backend; o front só
 * consulta. A consulta periódica NÃO roda com a aba escondida (padrão do React
 * Query: `refetchIntervalInBackground: false`) e volta na hora ao focar.
 */

export const depositKeys = {
  options: [...DEPOSITS_KEY, "options"] as const,
  list: [...DEPOSITS_KEY, "list"] as const,
  item: (id: string) => [...DEPOSITS_KEY, "item", id] as const,
  quote: (p: { chain: BackendChain; symbol: string; amountBrlCents: number }) =>
    [...DEPOSITS_KEY, "quote", p.chain, p.symbol, p.amountBrlCents] as const,
};

/** 4xx é resposta definitiva (validação/limite/404): repetir não muda nada. */
function retryUnlessClientError(failureCount: number, error: unknown): boolean {
  if (error instanceof AxiosError) {
    const s = error.response?.status ?? 0;
    if (s >= 400 && s < 500 && s !== 408 && s !== 429) return false;
  }
  return failureCount < 2;
}

export function useDepositOptions(enabled: boolean) {
  return useQuery({
    queryKey: depositKeys.options,
    queryFn: getDepositOptions,
    enabled,
    // Limite diário e cotação mudam: relê ao reabrir o modal após 30 s.
    staleTime: 30_000,
    retry: retryUnlessClientError,
  });
}

/**
 * Cotação de um valor. `params` null = nada a cotar (valor inválido). Quem
 * chama passa o valor JÁ com debounce (`useDebouncedValue`). Enquanto a nova
 * cotação chega, mantém a anterior SÓ se for da mesma moeda.
 */
export function useDepositQuote(
  params: { chain: BackendChain; symbol: string; amountBrlCents: number } | null,
) {
  return useQuery({
    queryKey: params ? depositKeys.quote(params) : [...DEPOSITS_KEY, "quote", "none"],
    queryFn: () => getDepositQuote(params!),
    enabled: params !== null,
    staleTime: 20_000,
    retry: retryUnlessClientError,
    placeholderData: (prev) =>
      prev && params && prev.symbol === params.symbol ? prev : undefined,
  });
}

export function useDepositsList(enabled: boolean) {
  return useQuery({
    queryKey: depositKeys.list,
    queryFn: listDeposits,
    enabled,
    staleTime: 15_000,
    retry: retryUnlessClientError,
  });
}

/** Um depósito, consultado no ritmo do status (3 s esperando o Pix, 5 s entregando). */
export function useDeposit(id: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: depositKeys.item(id ?? ""),
    queryFn: () => getDeposit(id!),
    enabled: id !== null,
    refetchInterval: (q) => pollInterval(q.state.data?.status),
    refetchOnWindowFocus: (q) => pollInterval(q.state.data?.status) !== false,
    retry: retryUnlessClientError,
  });

  // Chegou ao fim (entregue/falhou/venceu): a lista de recentes muda de chip.
  const status = query.data?.status;
  useEffect(() => {
    if (status && isTerminal(status)) void qc.invalidateQueries({ queryKey: depositKeys.list });
  }, [status, qc]);

  return query;
}

export function useCreateDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createDeposit,
    onSuccess: (d) => {
      qc.setQueryData(depositKeys.item(d.id), d);
      void qc.invalidateQueries({ queryKey: depositKeys.list });
      // O limite diário restante mudou.
      void qc.invalidateQueries({ queryKey: depositKeys.options });
    },
  });
}

/**
 * Reabre um depósito da lista: semeia o cache com o item (a tela abre na hora)
 * mas marcado como velho, para a consulta buscar o status atual já no mount.
 */
export function useSeedDeposit() {
  const qc = useQueryClient();
  return (d: DepositView) => {
    if (!qc.getQueryData(depositKeys.item(d.id))) {
      qc.setQueryData(depositKeys.item(d.id), d, { updatedAt: 0 });
    }
  };
}

/**
 * Valor com atraso — a cotação só sai quando o usuário para de digitar.
 * Passe um PRIMITIVO: objeto novo a cada render reiniciaria o timer sempre.
 */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
