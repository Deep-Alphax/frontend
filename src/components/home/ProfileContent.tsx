"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPortfolioAnalytics, getWalletBalance } from "@/lib/api/analytics";
import { getWallets, type Wallet } from "@/lib/api/wallets";
import { useSession } from "@/lib/auth/useSession";
import { useSyncEvents } from "@/lib/realtime/useSyncEvents";
import { useWalletSelection } from "@/lib/store/walletSelection";
import { ConnectWalletEmptyState } from "@/components/home/ConnectWalletEmptyState";
import { WalletSyncingState } from "@/components/home/WalletSyncingState";
import { ProfileDashboard } from "@/components/home/dashboard/ProfileDashboard";

/** Esqueleto enquanto as métricas carregam. */
function DashboardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-hidden>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-2" />
        ))}
      </div>
      <div className="h-[460px] rounded-lg bg-gray-2" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="h-72 rounded-lg bg-gray-2" />
        <div className="h-72 rounded-lg bg-gray-2" />
      </div>
    </div>
  );
}

/** Há carteira com ingestão em andamento. */
function isSyncing(wallets: Wallet[]): boolean {
  return wallets.some((w) => w.syncStatus === "PENDING" || w.syncStatus === "SYNCING");
}

/** Erro ao carregar as métricas (ex.: backend fora do ar). Retry manual, sem loop. */
function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-lg border border-gray-6 bg-gray-2 px-6 py-16 text-center">
      <p className="text-base text-gray-11">
        Não foi possível carregar as métricas agora. Verifique sua conexão e tente de novo.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-principal-9 px-6 py-2.5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
      >
        Tentar de novo
      </button>
    </div>
  );
}

/**
 * Conteúdo do perfil. A tela "conecte uma carteira" aparece SOMENTE sem carteira;
 * com carteira, sempre o dashboard (zerado se não houver trades na janela).
 *
 * Atualização em TEMPO REAL (sem polling): o backend empurra `sync:update` via
 * WebSocket ao terminar a ingestão de uma carteira; `useSyncEvents` invalida a
 * lista de carteiras e as métricas, e o dashboard sai do "sincronizando" sozinho.
 */
export function ProfileContent() {
  const { isAuthenticated, isLoading: authLoading } = useSession();
  const selectedWalletId = useWalletSelection((s) => s.selectedWalletId);
  const select = useWalletSelection((s) => s.select);
  const queryClient = useQueryClient();

  // Carteira recém-conectada cujos DADOS ainda não chegaram. Enquanto setado,
  // mostramos a animação (não o dashboard zerado) — cobre o sync "instantâneo",
  // em que o status vira SYNCED antes de o socket entregar as métricas.
  const [awaitingWalletId, setAwaitingWalletId] = useState<string | null>(null);

  // WebSocket: fim de sync → invalida ["wallets"]/["portfolio-analytics"]. Se a
  // carteira aguardada terminou SEM trades (ou com erro), encerra a espera (mostra
  // o dashboard vazio/erro). Com trades, a espera encerra quando os dados chegam.
  useSyncEvents(isAuthenticated, (payload) => {
    setAwaitingWalletId((cur) => {
      if (!cur || payload.walletId !== cur) return cur;
      const done = payload.status === "ERROR" || (payload.status === "SYNCED" && payload.inserted === 0);
      return done ? null : cur;
    });
  });

  const walletsQuery = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    retry: false,
    enabled: isAuthenticated,
  });
  const wallets = walletsQuery.data ?? [];
  const hasWallet = wallets.length > 0;
  const syncing = isSyncing(wallets);

  // Sem agregado "todas": garante SEMPRE uma carteira selecionada quando há carteiras.
  // Seleciona a 1ª quando nada está selecionado (load) OU a selecionada sumiu (removida).
  useEffect(() => {
    if (walletsQuery.isLoading) return;
    const list = walletsQuery.data ?? [];
    if (list.length === 0) return;
    const stillThere = selectedWalletId && list.some((w) => w.id === selectedWalletId);
    if (!stillThere) select(list[0].id);
  }, [selectedWalletId, walletsQuery.data, walletsQuery.isLoading, select]);

  // Detecta carteira(s) recém-CONECTADA(s). Ao conectar uma nova, ela vira a
  // SELECIONADA (o dashboard mostra os dados dela direto e o menu reflete a
  // seleção — sai do agregado "Todas") e recarrega as métricas. Só reage a IDs
  // ADICIONADOS; não mexe na seleção em reload/remoção. Guarda o snapshot anterior
  // dos IDs (null no 1º render → não auto-seleciona carteiras que já existiam).
  const prevWalletIds = useRef<string[] | null>(null);
  useEffect(() => {
    if (walletsQuery.isLoading) return;
    const ids = (walletsQuery.data ?? []).map((w) => w.id).sort();
    const prev = prevWalletIds.current;
    if (prev !== null) {
      const prevSet = new Set(prev);
      const added = ids.filter((id) => !prevSet.has(id));
      if (added.length > 0) {
        const newId = added[added.length - 1]; // conectou várias → a última
        queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
        select(newId);
        setAwaitingWalletId(newId); // segura a animação até os dados dela chegarem
      }
    }
    prevWalletIds.current = ids;
  }, [walletsQuery.data, walletsQuery.isLoading, queryClient, select]);

  const portfolioQuery = useQuery({
    // A seleção entra na chave → troca de carteira refaz a query certa. Janela: 30 dias.
    queryKey: ["portfolio-analytics", "D30", selectedWalletId],
    queryFn: () => getPortfolioAnalytics("D30", selectedWalletId),
    retry: false,
    // Só busca quando há carteira E uma selecionada (evita chamada solta com null).
    enabled: isAuthenticated && hasWallet && !!selectedWalletId,
    // Sem polling: o fim do sync chega por WebSocket (useSyncEvents) e invalida esta query.
  });
  const data = portfolioQuery.data;

  // Saldo ATUAL on-chain (holdings × preço) — busca on-chain via provider; leve e
  // independente das métricas. Backend cacheia 60s (contém custo/rate-limit Moralis).
  const balanceQuery = useQuery({
    queryKey: ["wallet-balance", selectedWalletId],
    queryFn: () => getWalletBalance(selectedWalletId),
    retry: false,
    enabled: isAuthenticated && hasWallet && !!selectedWalletId,
    staleTime: 30_000,
  });
  const dataReady = !!data && data.totalTrades > 0;

  // Rede de segurança: se nem os dados nem o evento de fim chegarem (socket caiu),
  // não deixa a espera presa para sempre. (setState assíncrono no timeout — ok.)
  useEffect(() => {
    if (!awaitingWalletId) return;
    const t = setTimeout(() => setAwaitingWalletId(null), 120_000);
    return () => clearTimeout(t);
  }, [awaitingWalletId]);

  if (authLoading) return <DashboardSkeleton />;
  if (!isAuthenticated) return <ConnectWalletEmptyState />;

  if (walletsQuery.isLoading) return <DashboardSkeleton />;
  if (!hasWallet) return <ConnectWalletEmptyState />;

  // Aguardando os dados da carteira recém-conectada: enquanto ela está selecionada
  // e ainda SEM dados. Derivado (sem setState) → some sozinho quando os dados chegam.
  const awaitingData =
    awaitingWalletId !== null && selectedWalletId === awaitingWalletId && !dataReady;

  // Mostra a animação enquanto: aguardando os dados da recém-conectada (cobre o sync
  // "instantâneo", em que o status vira SYNCED antes de os dados chegarem) OU há sync
  // em andamento sem trades. Evita o flash de dashboard ZERADO no intervalo.
  if (awaitingData || (syncing && (!data || data.totalTrades === 0))) {
    return <WalletSyncingState />;
  }

  // Erro ao buscar métricas (backend fora do ar, rede) → estado de erro com retry.
  // Evita o esqueleto pulsando pra sempre (o "piscando") e não re-tenta em loop.
  if (portfolioQuery.isError && !data) {
    return <DashboardError onRetry={() => void portfolioQuery.refetch()} />;
  }

  // Tem carteira → dashboard (mesmo tudo zerado). Esqueleto só no 1º load.
  if (!data) return <DashboardSkeleton />;
  return <ProfileDashboard data={data} balanceUsd={balanceQuery.data?.balanceUsd ?? null} />;
}
