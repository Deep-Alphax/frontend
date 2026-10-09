import type {
  DeepScoreTier,
  HolderRowId,
  SignalState,
  TokenDetail,
  TokenSignalId,
  TrackerChain,
} from "@/lib/api/tracker";
import { ago } from "@/lib/tracker/format";

/*
 * Regras de exibição do drawer do token (Figma 1411:34396). Puras e testadas
 * em tokenDetail.test.ts — o componente só desenha o que sai daqui.
 */

// ─────────────────────────────── Sinais ───────────────────────────────

/** Rótulo de cada sinal; `bad` troca o texto quando o Figma troca (ex.: "Liquidity removed"). */
const SIGNAL_LABEL: Record<TokenSignalId, { base: string; bad?: string }> = {
  kols_bought: { base: "KOLs bought" },
  groups_called: { base: "Groups called" },
  rick: { base: "Rick approved", bad: "Rick rejected" },
  volume: { base: "Volume accelerating" },
  holders: { base: "Clean holders", bad: "Concentrated holders" },
  liquidity: { base: "Liquidity locked", bad: "Liquidity removed" },
  dev: { base: "Dev holding", bad: "Dev sold" },
  bundle: { base: "No bundle", bad: "Bundle detected" },
};

export function signalLabel(id: TokenSignalId, state: SignalState): string {
  const l = SIGNAL_LABEL[id];
  return state === "bad" ? (l.bad ?? l.base) : l.base;
}

/**
 * Ordem dos segmentos do anel: bons, depois ruins, depois o resto (é como o
 * Figma pinta "4 de 8": 4 laranja, 3 vermelhos, 1 cinza).
 */
export function ringStates(
  signals: Array<{ state: SignalState }>,
): SignalState[] {
  const rank: Record<SignalState, number> = {
    good: 0,
    bad: 1,
    off: 2,
    unknown: 2,
  };
  return signals.map((s) => s.state).sort((a, b) => rank[a] - rank[b]);
}

export const TIER_LABEL: Record<DeepScoreTier, string> = {
  strong: "Strong",
  moderate: "Moderate",
  danger: "Danger",
};

// ─────────────────────────────── Avisos ───────────────────────────────

const pct = (frac: number) => `${Math.round(frac * 100)}%`;

function list(names: string[]): string {
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** Título + detalhe do banner (risco ou rug). null = sem banner. */
export function exitBanner(
  d: Pick<TokenDetail, "status" | "exit">,
  now = Date.now(),
): { title: string; detail: string } | null {
  const { exit } = d;
  if (d.status === "rugged") {
    const when = exit.rugAt ? ` ${ago(exit.rugAt, now)}` : "";
    const stuck =
      exit.stuckWallets > 0
        ? ` ${exit.stuckWallets} tracked wallet${exit.stuckWallets === 1 ? " is" : "s are"} stuck.`
        : "";
    return {
      title: `Token rugged: liquidity was removed${when}`,
      detail: `You can't buy or sell.${stuck}`,
    };
  }
  if (d.status !== "risk") return null;

  const facts: string[] = [];
  if (exit.liquidityDrop) {
    facts.push(
      `liquidity down ${pct(exit.liquidityDrop.pct)} in ${exit.liquidityDrop.minutes} min`,
    );
  }
  if (exit.mcDropFromHigh != null)
    facts.push(`market cap down ${pct(exit.mcDropFromHigh)} from the 1h high`);
  if (exit.exitedKols.length) {
    facts.push(`${list(exit.exitedKols)} already exited`);
  }
  const [first, ...rest] = facts;
  const detail = rest.length
    ? `${capitalize(rest.join(", "))}. Be careful entering.`
    : "Be careful entering.";
  return { title: `Exit signals: ${first ?? "the token is dropping"}`, detail };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─────────────────────────────── Gráfico ───────────────────────────────

/** Caixa do gráfico no Figma (Box gráfico 542×140, traço em 8..534 × 14..126). */
export const CHART_W = 542;
export const CHART_H = 140;
const PAD_X = 8;
const PAD_TOP = 14;
const PLOT_W = 526;
const PLOT_H = 112;

export interface ChartGeometry {
  line: string;
  area: string;
  trend: "up" | "down";
  /** Posição dos marcadores em % da caixa (HTML por cima do SVG — sem distorcer o círculo). */
  markers: Array<{ kind: string; left: number; top: number; t: string }>;
  first: number;
  last: number;
}

/** Série → paths do SVG (viewBox CHART_W×CHART_H) e marcadores. null = pontos insuficientes. */
export function chartGeometry(
  chart: TokenDetail["chart"],
): ChartGeometry | null {
  const pts = chart.points
    .map((p) => ({ t: Date.parse(p.t), mc: p.mc }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.mc));
  if (pts.length < 2) return null;
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const min = Math.min(...pts.map((p) => p.mc));
  const max = Math.max(...pts.map((p) => p.mc));
  const range = max - min;
  const x = (t: number) => PAD_X + ((t - t0) / span) * PLOT_W;
  const y = (mc: number) =>
    PAD_TOP + (range > 0 ? 1 - (mc - min) / range : 0.5) * PLOT_H;
  const xy = pts.map((p) => [round(x(p.t)), round(y(p.mc))] as const);

  const line = xy.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0]} ${CHART_H} L${xy[0][0]} ${CHART_H} Z`;

  // MC no instante do marcador: interpolação linear entre os pontos vizinhos.
  const mcAt = (t: number): number => {
    if (t <= t0) return pts[0].mc;
    if (t >= t1) return pts[pts.length - 1].mc;
    const i = pts.findIndex((p) => p.t >= t);
    const a = pts[i - 1];
    const b = pts[i];
    return a.mc + ((b.mc - a.mc) * (t - a.t)) / Math.max(1, b.t - a.t);
  };
  const markers = chart.markers
    .map((m) => ({ ...m, ms: Date.parse(m.t) }))
    .filter((m) => Number.isFinite(m.ms) && m.ms >= t0 && m.ms <= t1)
    .map((m) => ({
      kind: m.kind,
      t: m.t,
      left: round((x(m.ms) / CHART_W) * 100),
      top: round((y(mcAt(m.ms)) / CHART_H) * 100),
    }));

  const first = pts[0].mc;
  const last = pts[pts.length - 1].mc;
  return {
    line,
    area,
    trend: last >= first ? "up" : "down",
    markers,
    first,
    last,
  };
}

/** Legenda/cor dos marcadores, na ordem em que a legenda aparece. */
export const MARKER_KINDS: Array<{ kind: string; label: string }> = [
  { kind: "call", label: "Group call" },
  { kind: "super-alpha", label: "Super alpha" },
  { kind: "alpha", label: "Alpha" },
  { kind: "diamond", label: "Diamond" },
  { kind: "platinum", label: "Platinum" },
  { kind: "gold", label: "Gold" },
  { kind: "silver", label: "Silver" },
  { kind: "wood", label: "Wood" },
  { kind: "sniper", label: "Sniper" },
];

// ─────────────────────────────── Holders ───────────────────────────────

export const HOLDER_LABEL: Record<HolderRowId, string> = {
  top10: "Top 10",
  dev: "Dev",
  snipers: "Snipers",
  insiders: "Insiders",
  bundlers: "Bundlers",
  lp: "LP burned",
  fresh: "Fresh wallets",
};

/**
 * Largura da barra (% do trilho). Escala do Figma: 15px por ponto percentual
 * num trilho de 317px, teto de 300px — 20% já enche a barra (é "saúde", não
 * proporção do supply), e 0 vira um traço de 2px.
 */
export function holderBarWidth(pct: number): string {
  const px = Math.min(pct * 15, 300);
  return `max(2px, ${round((px / 317) * 100)}%)`;
}

/** "14%", "3.2%", "0.9%" — uma casa abaixo de 10. */
export function holderPct(v: number): string {
  return v >= 10 ? `${Math.round(v)}%` : `${Number(v.toFixed(1))}%`;
}

// ─────────────────────────────── Diversos ───────────────────────────────

/** Nome do explorer no chip de link. */
export function explorerName(chain: TrackerChain): string {
  const names: Record<TrackerChain, string> = {
    SOLANA: "Solscan",
    ETHEREUM: "Etherscan",
    BASE: "Basescan",
    BSC: "BscScan",
    ARBITRUM: "Arbiscan",
    POLYGON: "Polygonscan",
    OPTIMISM: "Etherscan",
  };
  return names[chain];
}

/** "Fr0iNk7aQ…pump": 9 primeiros + 4 últimos (o formato do chip no Figma). */
export function contractLabel(mint: string): string {
  return mint.length > 16 ? `${mint.slice(0, 9)}…${mint.slice(-4)}` : mint;
}

/** Múltiplo: "3.3x", "12x". */
export function multipleLabel(v: number): string {
  return v >= 10 ? `${Math.round(v)}x` : `${Number(v.toFixed(1))}x`;
}

/** % do supply: "0.8%", "0.04%", "<0.01%". */
export function supplyLabel(v: number): string {
  if (v > 0 && v < 0.01) return "<0.01%";
  return `${Number(v.toFixed(v >= 1 ? 1 : 2))}%`;
}

const round = (v: number) => Math.round(v * 100) / 100;
