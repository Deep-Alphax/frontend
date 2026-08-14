"use client";

import { useQuery } from "@tanstack/react-query";
import type { MetricPeriod } from "@/lib/api/analytics";
import { getDiscordSourcesAnalytics } from "@/lib/api/sources";
import { useWalletSelection } from "@/lib/store/walletSelection";
import { SourcesTab } from "@/components/home/dashboard/SourcesTab";

/** Esqueleto enquanto o breakdown por fonte carrega. */
function SourcesSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-6 bg-gray-2" aria-hidden>
      <div className="border-b border-gray-6 p-6">
        <div className="h-5 w-56 rounded bg-gray-3" />
      </div>
      <div className="flex flex-col gap-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 rounded bg-gray-3" />
        ))}
      </div>
    </div>
  );
}

/**
 * Container da tab "Fontes": "De onde vieram os trades" cruzando os trades com as
 * calls dos grupos do Discord (atribuição por servidor). Busca SOB DEMANDA (só
 * monta ao abrir a aba). Erro/ausência → lista vazia (empty state da tab).
 */
export function SourcesTabContainer({ period = "D30" }: { period?: MetricPeriod }) {
  // Escopa à carteira selecionada (igual às outras tabs) — não agrega todas.
  const selectedWalletId = useWalletSelection((s) => s.selectedWalletId);
  const { data, isLoading } = useQuery({
    queryKey: ["discord-sources-analytics", period, selectedWalletId],
    queryFn: () => getDiscordSourcesAnalytics(period, selectedWalletId),
    retry: false,
  });

  return isLoading ? <SourcesSkeleton /> : <SourcesTab sources={data ?? []} />;
}
