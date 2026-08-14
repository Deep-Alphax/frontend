"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { PortfolioAnalytics } from "@/lib/api/analytics";
import {
  formatSignedUsd,
  formatUsd,
  formatPct,
  formatSignedPct,
  formatShortDate,
  signOf,
} from "@/lib/format";
import { deriveDrawdownWindow } from "@/lib/deriveDrawdown";
import { InfoHint } from "@/components/ui/InfoHint";
import { RichInfoHint, type TooltipTone } from "@/components/ui/RichInfoHint";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const GREEN = "#55b467";
const RED = "#e5484d";

const toneOf = (v: string | number): TooltipTone =>
  signOf(v) > 0 ? "positive" : signOf(v) < 0 ? "negative" : "default";

function MiniKpi({
  label,
  hint,
  children,
  footer,
}: {
  label: string;
  hint: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 px-6 py-5">
      <div className="flex items-center gap-2 text-gray-12">
        <span className="text-base">{label}</span>
        {hint}
      </div>
      <div className="text-2xl font-semibold text-gray-12">{children}</div>
      <div className="text-sm text-gray-11">{footer}</div>
    </div>
  );
}

export function CapitalEvolutionCard({ data }: { data: PortfolioAnalytics }) {
  const { capital, bankroll, benchmark, realizedPnlUsd, perDay, daily } = data;

  // Defensivo: backend antigo (ainda não reiniciado) não devolve `unrealized`.
  const unrealized = data.unrealized ?? {
    available: false,
    unrealizedPnlUsd: null,
    openPositions: 0,
    pricedPositions: 0,
  };

  // PnL Total = realizado (fechado) + não-realizado (posições em carteira a preço atual).
  const unrealizedUsd =
    unrealized.available && unrealized.unrealizedPnlUsd != null
      ? Number(unrealized.unrealizedPnlUsd)
      : 0;
  const totalPnlUsd = Number(realizedPnlUsd) + unrealizedUsd;

  const { chartData, options } = useMemo(() => {
    const labels = capital.points.map((p) => formatShortDate(p.date));
    const usd = capital.points.map((p) => Number(p.cumulativePnlUsd));

    const solByDate = new Map(benchmark.points.map((p) => [p.date, Number(p.portfolioInSol)]));
    const sol = capital.points.map((p) => solByDate.get(p.date) ?? null);

    const datasets: ChartDataset<"line", (number | null)[]>[] = [
      {
        label: "Capital em dólar",
        data: usd,
        borderColor: GREEN,
        backgroundColor: "rgba(85, 180, 103, 0.15)",
        fill: "origin",
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        yAxisID: "y",
      },
    ];
    if (benchmark.available) {
      datasets.push({
        label: "Medido em SOL",
        data: sol,
        borderColor: RED,
        backgroundColor: "rgba(229, 72, 77, 0.10)",
        fill: "origin",
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
        yAxisID: "y1",
        spanGaps: true,
      });
    }

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#21222b",
          borderColor: "#3d3f4a",
          borderWidth: 1,
          titleColor: "#fafafd",
          bodyColor: "#c0c2ce",
          padding: 12,
          callbacks: {
            label: (ctx) =>
              ctx.dataset.yAxisID === "y1"
                ? `${(ctx.parsed.y ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} SOL`
                : formatSignedUsd(ctx.parsed.y ?? 0),
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#c0c2ce", maxTicksLimit: 6, font: { size: 12 } },
        },
        y: {
          grid: { color: "#21222b" },
          border: { display: false },
          ticks: {
            color: "#c0c2ce",
            font: { size: 12 },
            callback: (value) => formatUsd(Number(value)),
          },
        },
        y1: { display: false, grid: { display: false } },
      },
    };

    return { chartData: { labels, datasets }, options };
  }, [capital.points, benchmark]);

  // ── Tooltips ricos dos mini-KPIs ──
  const resultTooltip = (
    <RichInfoHint
      title="PNL Total"
      description="Realizado (fechado) + não-realizado (em carteira)"
      rows={[
        { label: "Realizado", value: formatSignedUsd(realizedPnlUsd), tone: toneOf(realizedPnlUsd) },
        {
          label: "Não-realizado",
          value: unrealized.available ? formatSignedUsd(unrealizedUsd) : "—",
          tone: unrealized.available ? toneOf(unrealizedUsd) : "default",
        },
        { label: "Total", value: formatSignedUsd(totalPnlUsd), tone: toneOf(totalPnlUsd) },
        {
          label: "Variação",
          value: bankroll.pnlPctOfBankroll != null ? formatSignedPct(bankroll.pnlPctOfBankroll) : "—",
          tone: bankroll.pnlPctOfBankroll != null ? toneOf(bankroll.pnlPctOfBankroll) : "default",
        },
      ]}
      footer="Realizado já líquido de taxa/gas/tip; não-realizado a preço atual"
    />
  );

  const dw = deriveDrawdownWindow(capital.points);
  const drawdownTooltip = (
    <RichInfoHint
      title="Maior Drawdown"
      description="Mede quanto o capital recuou do ponto mais alto antes de voltar a subir"
      rows={[
        { label: "Topo em", value: dw ? formatShortDate(dw.peakDate) : "—" },
        { label: "Fundo em", value: dw ? formatShortDate(dw.troughDate) : "—" },
        { label: "Duração", value: dw ? `${dw.durationDays} dias` : "—" },
        {
          label: "Queda",
          value: bankroll.maxDrawdownPct != null ? formatPct(-bankroll.maxDrawdownPct, 1) : "—",
          tone: "negative",
        },
        { label: "Em dinheiro", value: `−${formatUsd(capital.maxDrawdownUsd)}`, tone: "negative" },
      ]}
    />
  );

  const daysNegative = daily.filter((d) => Number(d.realizedPnlUsd) < 0).length;
  const daysTooltip = (
    <RichInfoHint
      title="Distribuição dos dias"
      rows={[
        { label: "Dias positivos", value: String(capital.daysInGreen) },
        { label: "Dias negativos", value: String(daysNegative) },
        { label: "Dias sem operar", value: String(capital.inactiveDays) },
        {
          label: "Melhor do dia",
          value: perDay.bestDay ? formatSignedUsd(perDay.bestDay.realizedPnlUsd) : "—",
          tone: "positive",
        },
        {
          label: "Pior dia",
          value: perDay.worstDay ? formatSignedUsd(perDay.worstDay.realizedPnlUsd) : "—",
          tone: "negative",
        },
      ]}
    />
  );

  const drawdownDisplay =
    bankroll.maxDrawdownPct != null
      ? formatPct(-bankroll.maxDrawdownPct, 1)
      : `−${formatUsd(capital.maxDrawdownUsd)}`;

  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2">
      <div className="flex items-center justify-between border-b border-gray-6 px-6 py-4">
        <h3 className="text-base font-semibold text-gray-12">Evolução do capital</h3>
        <span className="text-sm text-gray-11">
          em dólar {benchmark.available ? "vs. medido em SOL" : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-6 border-b border-gray-6 lg:grid-cols-4">
        <MiniKpi
          label="PNL Total"
          hint={resultTooltip}
          footer={
            bankroll.pnlPctOfBankroll != null
              ? `${formatSignedPct(bankroll.pnlPctOfBankroll)} sobre o bankroll`
              : "Realizado + não-realizado"
          }
        >
          <span
            className={
              signOf(totalPnlUsd) < 0
                ? "text-danger-11"
                : signOf(totalPnlUsd) > 0
                  ? "text-green-11"
                  : "text-gray-12"
            }
          >
            {formatSignedUsd(totalPnlUsd)}
          </span>
        </MiniKpi>

        <MiniKpi
          label="PNL não-realizado"
          hint={
            <InfoHint text="Lucro/prejuízo em aberto das posições que você ainda segura: valor atual (preço de mercado × quantidade) menos a base de custo. Token sem preço de mercado (rugado) conta como perda total." />
          }
          footer={
            unrealized.available
              ? `${unrealized.openPositions} ${unrealized.openPositions === 1 ? "posição" : "posições"} em carteira`
              : "Nada em carteira"
          }
        >
          <span
            className={
              !unrealized.available
                ? "text-gray-12"
                : signOf(unrealizedUsd) < 0
                  ? "text-danger-11"
                  : signOf(unrealizedUsd) > 0
                    ? "text-green-11"
                    : "text-gray-12"
            }
          >
            {unrealized.available ? formatSignedUsd(unrealizedUsd) : formatUsd(0)}
          </span>
        </MiniKpi>

        <MiniKpi
          label="Maior drawdown"
          hint={drawdownTooltip}
          footer={`−${formatUsd(capital.maxDrawdownUsd)} no período`}
        >
          <span className="text-danger-11">{drawdownDisplay}</span>
        </MiniKpi>

        <MiniKpi
          label="Dias no verde"
          hint={daysTooltip}
          footer={`${capital.inactiveDays} dias sem operar`}
        >
          {capital.daysInGreen}
        </MiniKpi>
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-center gap-4 text-sm text-gray-11">
          <span className="flex items-center gap-2">
            <span className="size-3 rounded-sm bg-green-10" /> Capital em dólar
          </span>
          {benchmark.available ? (
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-sm bg-danger-10" /> Medido em SOL
            </span>
          ) : null}
        </div>
        <div className="h-[320px] w-full">
          {capital.points.length > 0 ? (
            <Line data={chartData} options={options} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-11">
              Sem operações no período.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
