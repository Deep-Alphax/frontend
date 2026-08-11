"use client";

import { useQuery } from "@tanstack/react-query";
import type { MetricPeriod } from "@/lib/api/analytics";
import { getSourcesAnalytics } from "@/lib/api/sources";
import { SourcesTab } from "@/components/home/dashboard/SourcesTab";
import { SourcesManager } from "@/components/home/dashboard/SourcesManager";

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
 * Container da tab "Fontes": busca o breakdown por fonte SOB DEMANDA (só monta
 * quando a aba é aberta → não pesa o carregamento do dashboard) e o entrega ao
 * `SourcesTab` (apresentacional). Erro/ausência → lista vazia (empty state da tab).
 */
export function SourcesTabContainer({ period = "D30" }: { period?: MetricPeriod }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sources-analytics", period],
    queryFn: () => getSourcesAnalytics(period),
    retry: false,
  });

  return (
    <div className="flex flex-col gap-8">
      <SourcesManager />
      {isLoading ? <SourcesSkeleton /> : <SourcesTab sources={data ?? []} />}
    </div>
  );
}
