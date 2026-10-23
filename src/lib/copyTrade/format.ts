import type { CopyKol } from "@/lib/api/copyTrade";
import type { FeedPlatform, TrackerFeedItem } from "@/lib/api/tracker";
import { tokenLabel } from "@/lib/tracker/format";
import { KOL_TYPE_MAP } from "@/lib/walletReader/types";

/*
 * Formatação e regras de exibição do Copy Trade (UI em inglês, decisão de
 * 28/09): "+312 SOL", "−0.8 SOL", "2 h 05 min" — sinal de menos tipográfico,
 * como no resto da plataforma.
 */

const MINUS = "−";

/** Quantidade de SOL legível: 312 → "312", 16.34 → "16.3", 0.6 → "0.6", 0.042 → "0.04". */
function solNumber(v: number): string {
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 1 ? 1 : 2;
  return a.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** "+312 SOL" / "−0.8 SOL" / "0 SOL". */
export function signedSol(v: number, unit = true): string {
  const shown = solNumber(v);
  const sign = shown === "0" ? "" : v > 0 ? "+" : v < 0 ? MINUS : "";
  return `${sign}${shown}${unit ? " SOL" : ""}`;
}

/** "3.6 SOL" — sem sinal (aposta média, valor de uma compra). */
export function sol(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${solNumber(v)} SOL`;
}

/** Cor do resultado: verde ganho, vermelho perda, neutro zero/sem dado. */
export function pnlTone(v: number | null | undefined): string {
  if (v == null || v === 0) return "text-gray-12";
  return v > 0 ? "text-green-11" : "text-vermelho-11";
}

/** "58%" ou "—" quando ainda não há compra avaliada. */
export function hitLabel(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}

/** Tempo de holding: "45 min", "2 h 05 min", "3 d 4 h". */
export function holdLabel(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "< 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${String(min % 60).padStart(2, "0")} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** "@reefcalls" quando há handle; senão o nome do índice. */
export function kolHandle(k: Pick<CopyKol, "handle" | "name">): string {
  return k.handle ? `@${k.handle.replace(/^@/, "")}` : k.name;
}

/** Papel principal (1º tipo da taxonomia): "Sniper", "Copytrader"… */
export function kolRole(types: string[]): string | null {
  const id = types[0];
  return id ? (KOL_TYPE_MAP[id]?.label ?? null) : null;
}

/** Carteira avulsa no Wallet Copy: "7xKX…9fQ2" (4 + 4, como no Figma 1642:34085). */
export function walletShort(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

/** Iniciais da carteira sem perfil de KOL: os 2 primeiros caracteres ("7X"). */
export function walletInitials(addr: string): string {
  return addr.slice(0, 2).toUpperCase();
}

/** "128 trades" — atividade de 30d no lugar do nº de seguidores (sem fonte). */
export function tradesLabel(k: Pick<CopyKol, "stats">): string {
  const n = k.stats ? k.stats.buys + k.stats.sells : 0;
  return `${n.toLocaleString("en-US")} ${n === 1 ? "trade" : "trades"} 30d`;
}

// ───────────────────────────── Linha do tempo ─────────────────────────────

export type TimelineEvent =
  | {
      kind: "buy" | "sell";
      id: string;
      at: string;
      token: string;
      quoteAmount: number;
      quoteSymbol: string;
      mcUsd: number | null;
      /** Só vendas: MC da venda ÷ MC da 1ª compra do mesmo card. */
      multiple: number | null;
    }
  | {
      kind: "call";
      id: string;
      at: string;
      token: string;
      group: string | null;
      platform: FeedPlatform;
      text: string;
    };

/**
 * Achata os cards do feed do Tracker (KOL × token, até 4 trades + a call)
 * em eventos da linha do tempo, do mais novo ao mais antigo.
 */
export function timelineEvents(items: TrackerFeedItem[], limit = 30): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const it of items) {
    const token = tokenLabel(it.token);
    const firstBuy = it.trades
      .filter((t) => t.side === "BUY" && t.mcUsd)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0];
    for (const t of it.trades) {
      const multiple =
        t.side === "SELL" && t.mcUsd && firstBuy?.mcUsd ? t.mcUsd / firstBuy.mcUsd : null;
      out.push({
        kind: t.side === "BUY" ? "buy" : "sell",
        id: t.id,
        at: t.at,
        token,
        quoteAmount: t.quoteAmount,
        quoteSymbol: t.quoteSymbol,
        mcUsd: t.mcUsd,
        multiple,
      });
    }
    if (it.call) {
      out.push({
        kind: "call",
        id: `call:${it.call.messageId}`,
        at: it.call.at,
        token,
        group: it.call.group,
        platform: it.call.platform,
        text: it.call.text,
      });
    }
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/** Onde foi a call: "Reef Calls" (grupo) ou a plataforma ("pump.fun"). */
export function callPlace(e: { group: string | null; platform: FeedPlatform }): string {
  if (e.group) return e.group;
  const names: Record<FeedPlatform, string> = {
    DISCORD: "Discord",
    TELEGRAM: "Telegram",
    PUMPFUN: "pump.fun",
    FOMO: "FOMO",
  };
  return names[e.platform];
}

/** "3.2x" — múltiplo com uma casa (≥10x sem casa). */
export function multipleLabel(v: number): string {
  return `${v >= 10 ? Math.round(v) : Math.round(v * 10) / 10}x`;
}

// ───────────────────────────── Gráfico ─────────────────────────────

export interface ChartGeometry {
  line: string;
  area: string;
  /** y das linhas tracejadas (topo, meio e base do Figma). */
  grid: number[];
  /** y do zero (base sólida). */
  zeroY: number;
  last: { x: number; y: number };
}

/**
 * Curva do "Resultado acumulado" (Figma: 388 × 150, base em y=144, topo em
 * y=26). A escala sempre inclui o zero: resultado negativo desce abaixo da base.
 */
export function chartGeometry(series: number[], width = 388, top = 26, bottom = 144): ChartGeometry {
  const pts = series.length ? series : [0];
  const min = Math.min(0, ...pts);
  // Série toda em zero: sem amplitude, a escala vira [0, 1] e a linha fica na
  // base — com `span || 1` sozinho o zero subia para o topo.
  const max = Math.max(0, ...pts) || (min < 0 ? 0 : 1);
  const span = max - min;
  const x0 = 2;
  const x1 = width - 2;
  const step = pts.length > 1 ? (x1 - x0) / (pts.length - 1) : 0;
  const y = (v: number) => top + ((max - v) / span) * (bottom - top);
  const xy = pts.map((v, i) => ({ x: round1(x0 + i * step), y: round1(y(v)) }));
  const zeroY = round1(y(0));
  const line = xy.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");
  const last = xy[xy.length - 1];
  return {
    line,
    area: `${line}L${last.x} ${zeroY}L${xy[0].x} ${zeroY}Z`,
    grid: [top, round1((top + bottom) / 2), bottom],
    zeroY,
    last,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Dias inteiros desde `iso` (0 = hoje). */
export function daysAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
}

/**
 * Posição de `iso` no eixo de uma janela de N dias que termina agora (0 = início,
 * 1 = hoje). null = fora da janela — o marcador "Você copia" não aparece.
 */
export function windowFraction(iso: string, days = 30, now = Date.now()): number | null {
  const span = days * 86_400_000;
  const f = (Date.parse(iso) - (now - span)) / span;
  return f > 0 && f < 1 ? f : null;
}
