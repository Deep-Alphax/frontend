"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { RichInfoHint, type TooltipTone } from "@/components/ui/RichInfoHint";
import { cn } from "@/lib/cn";

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

  // Confiança/liquidez: quantas das posições em carteira têm preço de mercado real
  // (vendáveis). Baixo % = boa parte do saldo é "poeira"/rugado sem liquidez.
  const liquidPct =
    unrealized.available && unrealized.openPositions > 0
      ? Math.round((unrealized.pricedPositions / unrealized.openPositions) * 100)
      : 0;

  // Índices por data p/ o tooltip por-dia do gráfico (Figma 180:5389).
  const lookups = useMemo(() => {
    const solByDate = new Map(
      benchmark.points.map((p) => [p.date, Number(p.portfolioInSol)]),
    );
    const dailyByDate = new Map(daily.map((d) => [d.date, d]));
    // Rodapé: um dos 3 MAIORES trades (por PnL) que saiu naquele dia. Fonte: peaks
    // (trades recentes com histórico de preço) — melhor dado por-trade disponível.
    const noteByDate = new Map<string, string>();
    const top3 = [...data.peaks.perTrade]
      .filter((t) => t.hasData)
      .sort((a, b) => Number(b.tradingPnlUsd) - Number(a.tradingPnlUsd))
      .slice(0, 3);
    for (const t of top3) {
      const day = t.exitTime.slice(0, 10);
      if (noteByDate.has(day)) continue;
      const name = t.symbol ?? `${t.mint.slice(0, 4)}…`;
      noteByDate.set(
        day,
        `Um dos 3 maiores trades: ${name}, saída de ${t.exitMultiple.toLocaleString(
          "pt-BR",
          { maximumFractionDigits: 1 },
        )}x e ${formatSignedUsd(t.tradingPnlUsd)}.`,
      );
    }
    return { solByDate, dailyByDate, noteByDate };
  }, [benchmark.points, daily, data.peaks.perTrade]);

  // Estado do tooltip externo do gráfico: índice do ponto + posição (clampados no
  // handler, sem ler ref no render — regra do lint do React 19).
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    index: number;
    left: number;
    top: number;
    below: boolean;
  } | null>(null);
  const lastIndexRef = useRef<number | null>(null);

  const externalTooltip = useCallback(
    (ctx: { chart: ChartJS; tooltip: import("chart.js").TooltipModel<"line"> }) => {
      const tt = ctx.tooltip;
      if (!tt.opacity || !tt.dataPoints?.length) {
        if (lastIndexRef.current !== null) {
          lastIndexRef.current = null;
          setTip(null);
        }
        return;
      }
      const index = tt.dataPoints[0].dataIndex;
      if (index === lastIndexRef.current) return;
      lastIndexRef.current = index;
      // Coordenadas de VIEWPORT (canvas rect + caret): o tooltip é renderizado via
      // portal com position:fixed → escapa do `overflow-hidden` do card (não some).
      const rect = ctx.chart.canvas.getBoundingClientRect();
      const left = Math.min(
        Math.max(rect.left + tt.caretX, 150),
        window.innerWidth - 150,
      );
      const top = rect.top + tt.caretY;
      setTip({ index, left, top, below: top < 240 }); // pouco espaço acima → abre p/ baixo
    },
    [],
  );

  const { chartData, options } = useMemo(() => {
    const labels = capital.points.map((p) => formatShortDate(p.date));
    const usd = capital.points.map((p) => Number(p.cumulativePnlUsd));

    const sol = capital.points.map((p) => lookups.solByDate.get(p.date) ?? null);

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
        // Tooltip externo (HTML) renderizado em React — layout do Figma 180:5389.
        tooltip: { enabled: false, external: externalTooltip },
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
  }, [capital.points, benchmark, lookups.solByDate, externalTooltip]);

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
      align="right"
      title="Dias no verde"
      description="Distribuição dos dias operados na janela"
      rows={[
        { label: "Dias positivos", value: String(capital.daysInGreen), tone: "positive" },
        { label: "Dias negativos", value: String(daysNegative), tone: "negative" },
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

  const unrealizedTooltip = (
    <RichInfoHint
      title="PNL não-realizado"
      description="Posições em carteira a valor realizável — o que dá pra sacar de fato"
      rows={[
        { label: "Posições em carteira", value: String(unrealized.openPositions) },
        {
          label: "Com mercado",
          value: unrealized.openPositions > 0
            ? `${unrealized.pricedPositions}/${unrealized.openPositions} · ${liquidPct}%`
            : "—",
        },
        {
          label: "Não-realizado",
          value: unrealized.available ? formatSignedUsd(unrealizedUsd) : "—",
          tone: unrealized.available ? toneOf(unrealizedUsd) : "default",
        },
      ]}
      footer="Quantidade real on-chain × preço de mercado, menos a base de custo. Token sem liquidez (rugado) vale 0."
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
          hint={unrealizedTooltip}
          footer={
            unrealized.available
              ? `${unrealized.openPositions} ${unrealized.openPositions === 1 ? "posição" : "posições"} · ${liquidPct}% com mercado`
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
        <div
          ref={chartWrapRef}
          className="relative h-[320px] w-full"
          onMouseLeave={() => {
            lastIndexRef.current = null;
            setTip(null);
          }}
        >
          {capital.points.length > 0 ? (
            <Line data={chartData} options={options} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-11">
              Sem operações no período.
            </div>
          )}
          {tip && capital.points[tip.index]
            ? createPortal(
                <ChartTooltip
                  point={capital.points[tip.index]}
                  day={lookups.dailyByDate.get(capital.points[tip.index].date)}
                  solCum={lookups.solByDate.get(capital.points[tip.index].date) ?? null}
                  note={lookups.noteByDate.get(capital.points[tip.index].date) ?? null}
                  peakDeployedUsd={bankroll.peakDeployedUsd}
                  left={tip.left}
                  top={tip.top}
                  below={tip.below}
                />,
                document.body,
              )
            : null}
        </div>
      </div>
    </section>
  );
}

/** Tooltip por-dia do gráfico de capital (Figma 180:5389). Renderizado sobre o
 *  canvas (posição já clampada). `pointer-events-none` p/ não bloquear o hover. */
function ChartTooltip({
  point,
  day,
  solCum,
  note,
  peakDeployedUsd,
  left,
  top,
  below,
}: {
  point: PortfolioAnalytics["capital"]["points"][number];
  day: PortfolioAnalytics["daily"][number] | undefined;
  solCum: number | null;
  note: string | null;
  peakDeployedUsd: string;
  left: number;
  top: number;
  below: boolean;
}) {
  const toneClass = (v: string | number) =>
    signOf(v) < 0 ? "text-danger-11" : signOf(v) > 0 ? "text-green-11" : "text-gray-12";

  const cumUsd = point.cumulativePnlUsd;
  const peak = Number(peakDeployedUsd);
  const bankrollPct = peak > 0 ? (Number(cumUsd) / peak) * 100 : null;
  const dateLabel = new Date(`${point.date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
  });

  const rows: { label: string; value: string; tone: string }[] = [
    { label: "Capital acumulado", value: formatSignedUsd(cumUsd), tone: toneClass(cumUsd) },
  ];
  if (bankrollPct != null) {
    rows.push({
      label: "Sobre o bankroll",
      value: formatSignedPct(bankrollPct),
      tone: toneClass(bankrollPct),
    });
  }
  if (solCum != null) {
    rows.push({
      label: "Medida em SOL",
      value: `${solCum >= 0 ? "+" : "−"}${Math.abs(solCum).toLocaleString("pt-BR", {
        maximumFractionDigits: 2,
      })} SOL`,
      tone: toneClass(solCum),
    });
  }
  if (day) {
    rows.push({
      label: "Resultado do dia",
      value: formatSignedUsd(day.realizedPnlUsd),
      tone: toneClass(day.realizedPnlUsd),
    });
    rows.push({ label: "Trades do dia", value: String(day.trades), tone: "text-gray-12" });
  }

  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 flex w-72 flex-col gap-4 rounded border border-gray-6 bg-gray-3 p-3 shadow-xl"
      style={{
        left,
        top,
        transform: below
          ? "translate(-50%, 16px)"
          : "translate(-50%, calc(-100% - 16px))",
      }}
    >
      <p className="text-sm font-medium text-gray-12">{dateLabel}</p>
      <div className="h-px w-full rounded-full bg-gray-6" />
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-4 whitespace-nowrap text-sm"
          >
            <span className="text-gray-11">{r.label}</span>
            <span className={cn("font-medium", r.tone)}>{r.value}</span>
          </div>
        ))}
      </div>
      {note ? (
        <>
          <div className="h-px w-full rounded-full bg-gray-6" />
          <p className="text-sm leading-snug text-principal-11">{note}</p>
        </>
      ) : null}
    </div>
  );
}
