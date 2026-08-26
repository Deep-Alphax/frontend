"use client";

import type { ReactNode } from "react";
import { Info, X } from "lucide-react";

import type { PortfolioAnalytics } from "@/lib/api/analytics";
import type { TradeSource } from "@/lib/analytics/sources";
import {
  formatCompactUsd,
  formatPct,
  formatShortDate,
  formatSignedPct,
  formatSignedUsd,
  formatUsd,
  signOf,
} from "@/lib/format";
import { cn } from "@/lib/cn";

type Tone = "green" | "red" | "neutral";

function toneClass(tone: Tone): string {
  return tone === "green"
    ? "text-green-11"
    : tone === "red"
      ? "text-vermelho-11"
      : "text-gray-12";
}

/** Mediana de uma lista (null se vazia). */
function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function multipleLabel(n: number | null): string {
  if (n == null) return "—";
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;
}

// ─────────────────────────── Peças compartilhadas ───────────────────────────

/** Casca do tooltip: card + header (título + fechar). Popover acima do chip. */
function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="w-[320px] overflow-hidden rounded-lg rounded-bl-sm border border-gray-6 bg-gray-2 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-gray-6 px-3 py-2">
        <h3 className="text-base font-semibold text-gray-12">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="text-gray-11 transition-colors hover:text-gray-12"
        >
          <X className="size-5" strokeWidth={2} />
        </button>
      </div>
      {children}
    </div>
  );
}

/** Valor grande + subtexto à direita. */
function ValueRow({
  value,
  valueTone = "neutral",
  sub,
}: {
  value: string;
  valueTone?: Tone;
  sub: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-3 pb-3 pt-4">
      <span className={cn("text-xl font-semibold", toneClass(valueTone))}>{value}</span>
      <span className="text-sm text-gray-11">{sub}</span>
    </div>
  );
}

/** Linha da quebra (rótulo à esquerda, valor colorido à direita). */
function Row({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between border-t border-gray-6 px-3 py-3 text-sm">
      <span className="text-gray-11">{label}</span>
      <span className={cn("font-semibold", toneClass(tone))}>{value}</span>
    </div>
  );
}

/** Rodapé de dica (ícone + texto). */
function InfoFooter({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-gray-6 px-3 py-3">
      <Info className="size-4 shrink-0 text-gray-11" strokeWidth={1.75} />
      <span className="text-sm text-gray-11">{text}</span>
    </div>
  );
}

/**
 * Mini-gráfico do PnL acumulado. Linha + área sutil. `color`: "auto" pinta pelo
 * sinal do último ponto; "red"/"green" força. `non-scaling-stroke` = traço fino.
 */
function Sparkline({ points, color = "auto" }: { points: number[]; color?: "auto" | "red" | "green" }) {
  if (points.length < 2) return <div className="h-16 w-full bg-gray-1" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const W = 100;
  const H = 100;
  const step = W / (points.length - 1);
  const coords = points.map((p, i) => [i * step, H - ((p - min) / range) * H] as const);
  const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const up = color === "auto" ? points[points.length - 1] >= 0 : color === "green";
  const stroke = up ? "var(--color-green-11)" : "var(--color-vermelho-11)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full bg-gray-1" aria-hidden>
      <path d={area} fill={stroke} opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─────────────────────────── Corpos por métrica ───────────────────────────

/** Resultado líquido (node 684:14377). Líquido = bruto de trading − gas/tip. */
function NetBody({ data, onClose }: { data: PortfolioAnalytics; onClose: () => void }) {
  const netSign = signOf(data.netPnlUsd);
  const points = data.capital.points.map((p) => Number(p.cumulativePnlUsd));
  const fees = Math.abs(Number(data.feesUsd));
  return (
    <Shell title="Resultado líquido" onClose={onClose}>
      <ValueRow
        value={formatSignedUsd(data.netPnlUsd)}
        sub={
          data.bankroll.pnlPctOfBankroll != null ? (
            <span className={netSign < 0 ? "text-vermelho-11" : "text-green-11"}>
              {formatSignedPct(data.bankroll.pnlPctOfBankroll)}
            </span>
          ) : null
        }
      />
      <Sparkline points={points} />
      <Row
        label="Bruto realizado"
        value={formatSignedUsd(data.tradingPnlUsd)}
        tone={signOf(data.tradingPnlUsd) < 0 ? "red" : "green"}
      />
      {/* Só a taxa de rede (gas+tip) é itemizável; swap/slippage não são capturados. */}
      <Row label="Gas + tip" value={formatSignedUsd(-fees)} tone={fees > 0 ? "red" : "neutral"} />
    </Shell>
  );
}

/** Ponto colorido da legenda. */
function Dot({ className }: { className: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", className)} aria-hidden />;
}

/** Taxa de acerto (node 684:15117). */
function WinBody({ data, onClose }: { data: PortfolioAnalytics; onClose: () => void }) {
  const { winners, losers, winRatePct, avgWinUsd, avgLossUsd, winLossRatio } = data.winRate;
  const decided = winners + losers;
  const winW = decided > 0 ? (winners / decided) * 100 : 0;
  return (
    <Shell title="Taxa de acerto" onClose={onClose}>
      <ValueRow
        value={formatPct(winRatePct, 1)}
        valueTone="green"
        sub={`${winners.toLocaleString("pt-BR")} de ${decided.toLocaleString("pt-BR")} trades`}
      />
      {/* Barra ganhos/perdas */}
      <div className="px-3 py-1">
        <div className="flex h-4 gap-0.5 overflow-hidden rounded-lg bg-gray-4">
          <div className="h-4 bg-green-9" style={{ width: `${winW}%` }} />
          <div className="h-4 flex-1 bg-vermelho-10" />
        </div>
      </div>
      {/* Legenda */}
      <div className="flex gap-4 px-3 pb-3 pt-2 text-sm">
        <span className="flex items-center gap-1.5">
          <Dot className="bg-green-9" />
          <span className="text-gray-11">Ganhos</span>
          <span className="font-semibold text-gray-12">{winners.toLocaleString("pt-BR")}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Dot className="bg-vermelho-10" />
          <span className="text-gray-11">Perdas</span>
          <span className="font-semibold text-gray-12">{losers.toLocaleString("pt-BR")}</span>
        </span>
      </div>
      <Row label="Ganho médio" value={formatSignedUsd(avgWinUsd)} tone="green" />
      <Row label="Perda média" value={formatSignedUsd(avgLossUsd)} tone="red" />
      <Row
        label="Razão ganho/perda"
        value={winLossRatio != null ? `${winLossRatio.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x` : "—"}
      />
      <InfoFooter text="Entre 25% e 40% é normal em memecoin." />
    </Shell>
  );
}

/** Buckets do histograma de captura do topo. */
const CAPTURE_BUCKETS = [
  { label: "0-25%", color: "bg-vermelho-9", lo: -Infinity, hi: 25 },
  { label: "25-50%", color: "bg-principal-9", lo: 25, hi: 50 },
  { label: "50-75%", color: "bg-green-9", lo: 50, hi: 75 },
  { label: "75%+", color: "bg-secundaria-9", lo: 75, hi: Infinity },
] as const;

/** Aproveitamento do topo (node 684:15860). */
function TopBody({ data, onClose }: { data: PortfolioAnalytics; onClose: () => void }) {
  const withData = data.peaks.perTrade.filter((t) => t.hasData);
  const counts = CAPTURE_BUCKETS.map(
    (b) => withData.filter((t) => t.capturePct >= b.lo && t.capturePct < b.hi).length,
  );
  const maxCount = Math.max(1, ...counts);
  const medExit = median(withData.map((t) => t.exitMultiple));
  const medPeak = median(withData.map((t) => t.peakMultiple));
  const value =
    data.peaks.available && data.peaks.topCapturePct != null
      ? formatPct(data.peaks.topCapturePct)
      : "—";
  return (
    <Shell title="Aproveitamento do topo" onClose={onClose}>
      <ValueRow value={value} sub="Bom acima de 50%" />
      {/* Histograma de captura */}
      <div className="flex items-start gap-2 px-3 py-4">
        {CAPTURE_BUCKETS.map((b, i) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-3">
            <span className="text-base font-semibold text-gray-12">{counts[i]}</span>
            <div className="relative h-16 w-full overflow-hidden rounded-lg bg-gray-5">
              <div
                className={cn("absolute inset-x-0 bottom-0 rounded-lg", b.color)}
                style={{ height: `${(counts[i] / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-12">{b.label}</span>
          </div>
        ))}
      </div>
      <Row label="Saída mediana" value={multipleLabel(medExit)} />
      <Row label="Topo mediano" value={multipleLabel(medPeak)} />
      <InfoFooter text="Acima de 50% é bom, acima de 70% é raro." />
    </Shell>
  );
}

/** Localiza o maior drawdown pico→vale no PnL acumulado + recuperação. */
function findDrawdown(points: { date: string; cumulativePnlUsd: string }[]) {
  if (points.length < 2) return null;
  const vals = points.map((p) => Number(p.cumulativePnlUsd));
  let peak = vals[0];
  let peakIdx = 0;
  let maxDrop = 0;
  let ddPeak = 0;
  let ddTrough = 0;
  for (let i = 0; i < vals.length; i++) {
    if (vals[i] > peak) {
      peak = vals[i];
      peakIdx = i;
    }
    const drop = peak - vals[i];
    if (drop > maxDrop) {
      maxDrop = drop;
      ddPeak = peakIdx;
      ddTrough = i;
    }
  }
  if (maxDrop <= 0) return null;
  const peakVal = vals[ddPeak];
  let recoveryIdx: number | null = null;
  for (let i = ddTrough + 1; i < vals.length; i++) {
    if (vals[i] >= peakVal) {
      recoveryIdx = i;
      break;
    }
  }
  const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  return {
    peakDate: points[ddPeak].date,
    troughDate: points[ddTrough].date,
    recoveryDays: recoveryIdx != null ? days(points[ddTrough].date, points[recoveryIdx].date) : null,
  };
}

/** Maior drawdown (node 696:18512). */
function DrawdownBody({ data, onClose }: { data: PortfolioAnalytics; onClose: () => void }) {
  const dd = findDrawdown(data.capital.points);
  const points = data.capital.points.map((p) => Number(p.cumulativePnlUsd));
  const pct = data.bankroll.maxDrawdownPct;
  return (
    <Shell title="Maior drawdown" onClose={onClose}>
      <ValueRow
        value={pct != null ? formatSignedPct(-Math.abs(pct)) : "—"}
        sub={dd?.recoveryDays != null ? `${dd.recoveryDays} dias para recuperar` : "Não recuperou"}
      />
      <Sparkline points={points} color="red" />
      <Row label="Pico" value={dd ? formatShortDate(dd.peakDate) : "—"} />
      <Row label="Fundo" value={dd ? formatShortDate(dd.troughDate) : "—"} />
      <Row
        label="Recuperou em"
        value={dd?.recoveryDays != null ? `${dd.recoveryDays} dias` : "—"}
      />
    </Shell>
  );
}

/** Operações por semana (4 últimas), somando `trades` dos dias de cada semana. */
function weeklyTrades(daily: { date: string; trades: number }[]): number[] {
  if (daily.length === 0) return [];
  const maxT = Math.max(...daily.map((d) => Date.parse(d.date)));
  const weeks = [0, 0, 0, 0];
  for (const d of daily) {
    const w = Math.floor((maxT - Date.parse(d.date)) / (7 * 86_400_000));
    if (w >= 0 && w <= 3) weeks[3 - w] += d.trades;
  }
  return weeks;
}

/** Linha com valor + nº de ordens à direita (Compras/Vendas). */
function OrdersRow({ label, usd, orders }: { label: string; usd: number; orders: number }) {
  return (
    <div className="flex items-center justify-between border-t border-gray-6 px-3 py-3 text-sm">
      <span className="text-gray-11">{label}</span>
      <span className="flex items-center gap-3 font-semibold text-gray-12">
        <span>{formatCompactUsd(usd)}</span>
        <span className="h-px w-1 bg-gray-6" aria-hidden />
        <span>{orders.toLocaleString("pt-BR")} ordens</span>
      </span>
    </div>
  );
}

/** Volume operado (node 698:13476). Histograma = operações por semana. */
function VolBody({ data, onClose }: { data: PortfolioAnalytics; onClose: () => void }) {
  const weeks = weeklyTrades(data.daily);
  const maxW = Math.max(1, ...weeks);
  const buyUsd = Number(data.entrySizes.totalBuyUsd);
  const vol = Number(data.volumeUsd);
  const sellUsd = Math.max(0, vol - buyUsd);
  const ticket = data.totalTrades > 0 ? vol / data.totalTrades : 0;
  return (
    <Shell title="Volume operado" onClose={onClose}>
      <ValueRow
        value={formatCompactUsd(data.volumeUsd)}
        sub={`${data.totalTrades.toLocaleString("pt-BR")} operações`}
      />
      {weeks.length === 4 && (
        <div className="flex items-start gap-2 px-3 py-4">
          {weeks.map((c, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-3">
              <span className="text-base font-semibold text-gray-12">{c}</span>
              <div className="relative h-16 w-full overflow-hidden rounded-lg bg-gray-5">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-lg bg-secundaria-9"
                  style={{ height: `${(c / maxW) * 100}%` }}
                />
              </div>
              <span className="text-sm text-gray-12">Sem {i + 1}</span>
            </div>
          ))}
        </div>
      )}
      <OrdersRow label="Compras" usd={buyUsd} orders={data.buys} />
      <OrdersRow label="Vendas" usd={sellUsd} orders={data.sells} />
      <Row label="Ticket médio" value={formatUsd(ticket)} />
    </Shell>
  );
}

/** Cor da barra por rank (positivos); negativo → vermelho. */
const SRC_BAR_COLORS = ["bg-green-11", "bg-violeta-11", "bg-azul-11", "bg-menta-11"] as const;

/** Formato do PnL da fonte (sinal + milhar pt-BR, sem prefixo — como no Figma). */
function signedInt(value: string): string {
  const n = Number(value);
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** Fonte mais lucrativa (node 698:20587): ranking das fontes por PnL. */
function SourcesBody({ sources, onClose }: { sources: TradeSource[]; onClose: () => void }) {
  const ranked = [...sources].sort((a, b) => Number(b.pnlUsd) - Number(a.pnlUsd)).slice(0, 6);
  const maxAbs = Math.max(1, ...ranked.map((s) => Math.abs(Number(s.pnlUsd))));
  return (
    <Shell title="Fonte mais lucrativa" onClose={onClose}>
      {ranked.length === 0 ? (
        <p className="px-3 py-4 text-sm text-gray-11">Nenhuma fonte com dados no período.</p>
      ) : (
        ranked.map((s, i) => {
          const pnl = Number(s.pnlUsd);
          const pct = Math.max(6, (Math.abs(pnl) / maxAbs) * 100);
          const color = pnl < 0 ? "bg-vermelho-9" : SRC_BAR_COLORS[i % SRC_BAR_COLORS.length];
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 border-t border-gray-6 px-3 py-3 text-sm"
            >
              <span className="min-w-0 truncate text-gray-11">{s.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-5">
                  <span className={cn("block h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                </span>
                <span className={cn("w-16 text-right font-semibold tabular-nums", pnl < 0 ? "text-vermelho-11" : "text-gray-12")}>
                  {signedInt(s.pnlUsd)}
                </span>
              </span>
            </div>
          );
        })
      )}
    </Shell>
  );
}

/**
 * Tooltip de detalhamento de uma métrica da barra inferior do Radar (nodes Figma
 * 684:14377 / 684:15117 / 684:15860 / 696:18512 / 698:13476 / 698:20587). Dados
 * reais do agregado das carteiras. Popover posicionado acima do chip pela barra.
 */
export function MetricTooltip({
  metricKey,
  data,
  sources,
  onClose,
}: {
  metricKey: string;
  data: PortfolioAnalytics;
  sources?: TradeSource[];
  onClose: () => void;
}) {
  switch (metricKey) {
    case "net":
      return <NetBody data={data} onClose={onClose} />;
    case "win":
      return <WinBody data={data} onClose={onClose} />;
    case "top":
      return <TopBody data={data} onClose={onClose} />;
    case "dd":
      return <DrawdownBody data={data} onClose={onClose} />;
    case "vol":
      return <VolBody data={data} onClose={onClose} />;
    case "src":
      return <SourcesBody sources={sources ?? []} onClose={onClose} />;
    default:
      return null;
  }
}
