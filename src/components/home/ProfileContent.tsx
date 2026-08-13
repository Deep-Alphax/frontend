"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPortfolioAnalytics } from "@/lib/api/analytics";
import { getWallets, type Wallet } from "@/lib/api/wallets";
import { useSession } from "@/lib/auth/useSession";
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

/** Intervalo do polling da LISTA de carteiras (leve) enquanto há sync em andamento. */
const WALLETS_POLL_MS = 20_000;

/**
 * Intervalo do polling das MÉTRICAS enquanto uma carteira sincroniza. Mais curto
 * que o da lista para o dashboard "acender" logo que a ingestão grava os trades,
 * sem esperar o ciclo de 20s. Só roda durante o sync (estado transitório) → não é loop.
 */
const METRICS_POLL_MS = 8_000;

/** Há carteira com ingestão em andamento. */
function isSyncing(wallets: Wallet[]): boolean {
  return wallets.some((w) => w.syncStatus === "PENDING" || w.syncStatus === "SYNCING");
}

/**
 * Conteúdo do perfil. A tela "conecte uma carteira" aparece SOMENTE sem carteira;
 * com carteira, sempre o dashboard (zerado se não houver trades na janela).
 *
 * Polling enxuto: só a LISTA de carteiras (barata) é religada enquanto sincroniza,
 * a cada 20s, para acompanhar o status. As MÉTRICAS (pesadas) são recarregadas
 * UMA vez, quando o sync termina — não ficam em loop.
 */
export function ProfileContent() {
  const { isAuthenticated, isLoading: authLoading } = useSession();
  const selectedWalletId = useWalletSelection((s) => s.selectedWalletId);
  const select = useWalletSelection((s) => s.select);
  const queryClient = useQueryClient();

  const walletsQuery = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    retry: false,
    enabled: isAuthenticated,
    refetchInterval: (query) => (isSyncing(query.state.data ?? []) ? WALLETS_POLL_MS : false),
  });
  const wallets = walletsQuery.data ?? [];
  const hasWallet = wallets.length > 0;
  const syncing = isSyncing(wallets);

  // Se a carteira selecionada sumiu (removida em outra aba, etc.) → volta ao agregado.
  useEffect(() => {
    const list = walletsQuery.data ?? [];
    if (selectedWalletId && !walletsQuery.isLoading && !list.some((w) => w.id === selectedWalletId)) {
      select(null);
    }
  }, [selectedWalletId, walletsQuery.data, walletsQuery.isLoading, select]);

  // Mudou o CONJUNTO de carteiras (conectou/removeu) → recarrega as métricas.
  // Cobre a conexão de carteira que sincroniza rápido (SYNCED antes do 1º poll):
  // o WalletVerifier invalida as métricas ANTES da ingestão gravar, então sem este
  // gatilho o dashboard ficaria preso no snapshot vazio até uma troca manual de carteira.
  const prevWalletIds = useRef<string | null>(null);
  useEffect(() => {
    if (walletsQuery.isLoading) return;
    const ids = (walletsQuery.data ?? [])
      .map((w) => w.id)
      .sort()
      .join(",");
    if (prevWalletIds.current !== null && prevWalletIds.current !== ids) {
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
    }
    prevWalletIds.current = ids;
  }, [walletsQuery.data, walletsQuery.isLoading, queryClient]);

  const portfolioQuery = useQuery({
    // A seleção entra na chave → troca de carteira refaz a query certa. Janela: 30 dias.
    queryKey: ["portfolio-analytics", "D30", selectedWalletId],
    queryFn: () => getPortfolioAnalytics("D30", selectedWalletId),
    retry: false,
    enabled: isAuthenticated && hasWallet, // só busca métricas quando há carteira
    // Enquanto sincroniza, repõe as métricas a cada 8s → o dashboard acende assim que
    // a ingestão grava os trades. Para automaticamente quando o sync termina.
    refetchInterval: syncing ? METRICS_POLL_MS : false,
  });

  if (authLoading) return <DashboardSkeleton />;
  if (!isAuthenticated) return <ConnectWalletEmptyState />;

  if (walletsQuery.isLoading) return <DashboardSkeleton />;
  if (!hasWallet) return <ConnectWalletEmptyState />;

  // Carteira recém-conectada ainda sincronizando e SEM trades → animação de sync +
  // barra de progresso. O painel abre sozinho: enquanto `syncing`, o portfolioQuery
  // faz polling (8s) e troca para o dashboard assim que os primeiros trades chegam.
  const data = portfolioQuery.data;
  if (syncing && (!data || data.totalTrades === 0)) {
    return <WalletSyncingState />;
  }

  // Tem carteira → dashboard (mesmo tudo zerado). Esqueleto só no 1º load.
  if (!data) return <DashboardSkeleton />;
  return <ProfileDashboard data={data} />;
}
