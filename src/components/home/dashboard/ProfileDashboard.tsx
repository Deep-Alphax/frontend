"use client";

import { useState } from "react";
import {
  CircleDollarSign,
  Gauge,
  Undo2,
  Activity,
  PieChart,
  Target,
} from "lucide-react";
import type { PortfolioAnalytics } from "@/lib/api/analytics";
import { formatPct, formatUsd } from "@/lib/format";
import { cn } from "@/lib/cn";
import { KpiItem } from "@/components/home/dashboard/KpiItem";
import { NoDataValue } from "@/components/home/dashboard/ComingSoon";
import { CapitalEvolutionCard } from "@/components/home/dashboard/CapitalEvolutionCard";
import { TradeOutcomesCard } from "@/components/home/dashboard/TradeOutcomesCard";
import { ProfitConcentrationCard } from "@/components/home/dashboard/ProfitConcentrationCard";
import { PeakVsExitCard } from "@/components/home/dashboard/PeakVsExitCard";
import { SourcesTabContainer } from "@/components/home/dashboard/SourcesTabContainer";
import { WhenWhereTab } from "@/components/home/dashboard/WhenWhereTab";

const TABS = ["Como os trades terminaram", "Fontes", "Quando e onde"] as const;
type Tab = (typeof TABS)[number];

export function ProfileDashboard({
  data,
  balanceUsd,
}: {
  data: PortfolioAnalytics;
  /** Saldo ATUAL on-chain (USD) da carteira/portfólio. null = indisponível. */
  balanceUsd?: string | null;
}) {
  const [tab, setTab] = useState<Tab>(TABS[0]);

  return (
    <div className="flex flex-col gap-10">
      {/* KPIs — linha 1 (valor grande) */}
      <div className="grid grid-cols-1 gap-8 border-b border-gray-6 pb-8 md:grid-cols-3 md:divide-x md:divide-gray-6">
        <div className="md:pr-8">
          <KpiItem
            icon={CircleDollarSign}
            label="Saldo atual"
            info="Saldo de SOL da carteira × preço do SOL agora. Considera só o SOL (ativo líquido)"
            hint="SOL nativo a preço de agora"
            value={balanceUsd != null ? formatUsd(balanceUsd) : <NoDataValue />}
          />
        </div>
        <div className="md:px-8">
          <KpiItem
            icon={Gauge}
            label="Aproveitamento do topo"
            info="Quanto do topo pós-entrada você capturou, em média (ponderado por tamanho)."
            hint="Acima de 50% é bom, acima de 70% é raro"
            value={
              data.peaks.available && data.peaks.topCapturePct != null ? (
                formatPct(data.peaks.topCapturePct)
              ) : (
                <NoDataValue />
              )
            }
          />
        </div>
        <div className="md:pl-8">
          <KpiItem
            icon={Undo2}
            label="Posições que devolveram"
            info="Posições que subiram (≥+50%) e devolveram mais da metade do ganho antes da saída."
            hint="Saudável abaixo de 10% dos trades"
            value={data.peaks.available ? data.peaks.gaveBackCount : <NoDataValue />}
          />
        </div>
      </div>

      {/* KPIs — linha 2 (valor à direita) */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:divide-x md:divide-gray-6">
        <div className="md:pr-8">
          <KpiItem
            layout="inline"
            icon={Activity}
            label="Sobrevida das suas escolhas"
            info="% dos seus tokens ainda vivos (com preço/liquidez atuais)."
            hint="Média do mercado perto de 12%"
            value={
              data.survival.available && data.survival.alivePct != null ? (
                formatPct(data.survival.alivePct)
              ) : (
                <NoDataValue />
              )
            }
          />
        </div>
        <div className="md:px-8">
          <KpiItem
            layout="inline"
            icon={PieChart}
            label="Concentração do lucro"
            info="Fatia do lucro que vem dos seus 3 melhores trades."
            hint="Consistente abaixo de 40%"
            value={formatPct(data.profitConcentration.top3.pct)}
          />
        </div>
        <div className="md:pl-8">
          <KpiItem
            layout="inline"
            icon={Target}
            label="Taxa de acerto"
            info="Trades vencedores sobre o total de posições fechadas."
            hint="Entre 25% e 40% é normal"
            value={formatPct(data.winRate.winRatePct, 1)}
          />
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-6 border-b border-gray-6">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm transition-colors",
              tab === t
                ? "border-principal-9 font-medium text-gray-12"
                : "border-transparent text-gray-11 hover:text-gray-12",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Como os trades terminaram" ? (
        <div className="flex flex-col gap-8">
          <CapitalEvolutionCard data={data} />

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <TradeOutcomesCard outcomes={data.outcomes} />
            <ProfitConcentrationCard concentration={data.profitConcentration} />
          </div>

          <PeakVsExitCard peaks={data.peaks} />
        </div>
      ) : tab === "Fontes" ? (
        <SourcesTabContainer />
      ) : (
        <WhenWhereTab weekdayBlocks={data.weekdayBlocks} />
      )}
    </div>
  );
}
