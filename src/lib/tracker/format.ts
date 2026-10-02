import type { TrackerChain } from "@/lib/api/tracker";

/*
 * Formatação do Tracker (UI em inglês, decisão de 28/09): "MC $46.9k",
 * "+$2,280", "−$456" (sinal de menos tipográfico, como no Figma).
 */

const MINUS = "−";

/** Valor compacto: 46_900 → "$46.9k", 1_340_000 → "$1.34M". */
export function compactUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? MINUS : "";
  if (a >= 1e9) return `${sign}$${trim(a / 1e9, 2)}B`;
  if (a >= 1e6) return `${sign}$${trim(a / 1e6, 2)}M`;
  if (a >= 1e3) return `${sign}$${trim(a / 1e3, a >= 1e5 ? 0 : 1)}k`;
  return `${sign}$${Math.round(a)}`;
}

/** "+$2,280" / "−$456" — PnL do card. */
export function signedUsd(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? MINUS : "";
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
}

/** "+38%" / "−4%" a partir de fração (0.38). */
export function signedPct(frac: number): string {
  const p = Math.round(frac * 100);
  return `${p > 0 ? "+" : p < 0 ? MINUS : ""}${Math.abs(p)}%`;
}

/** Quantidade de cotação: 12 → "12", 2.4 → "2.4", 0.08 → "0.08". */
export function quoteAmount(v: number): string {
  if (v >= 100) return Math.round(v).toLocaleString("en-US");
  if (v >= 1) return trim(v, 1);
  return trim(v, v >= 0.1 ? 2 : 3);
}

/** Idade curta: "now", "4 min", "1 h", "2 d". */
export function age(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

/** "18 min ago" para o cabeçalho do card. */
export function ago(iso: string, now = Date.now()): string {
  const a = age(iso, now);
  return a === "now" ? "now" : `${a} ago`;
}

/** Endereço curto do Discovery: "Bm3r…Lw2". */
export function shortAddress(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-3)}` : addr;
}

/**
 * Rótulo do token: "$SIMBOLO"; sem símbolo (token recém-lançado que nenhuma
 * fonte nomeou ainda), o contrato abreviado — nunca "$???".
 */
export function tokenLabel(t: { symbol: string | null; mint: string }): string {
  const s = t.symbol?.trim();
  if (s) return `$${s.replace(/^\$/, "")}`;
  return t.mint.length > 10 ? `${t.mint.slice(0, 4)}…${t.mint.slice(-4)}` : t.mint;
}

/** Iniciais de um nome/handle (avatar de letras). */
export function initials(s: string): string {
  const clean = s.replace(/^@/, "").replace(/[^A-Za-z0-9 ]/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "?";
}

function trim(v: number, digits: number): string {
  return Number(v.toFixed(digits)).toString();
}

/** Sigla da rede no chip ("SOL", "ETH", "Base", "BNB"). */
export const CHAIN_LABEL: Record<TrackerChain, string> = {
  SOLANA: "SOL",
  ETHEREUM: "ETH",
  BASE: "Base",
  BSC: "BNB",
  ARBITRUM: "ARB",
  POLYGON: "POL",
  OPTIMISM: "OP",
};

/** Selo da rede (asset do Figma, badge - rede 1371:32284). */
export const CHAIN_BADGE: Partial<Record<TrackerChain, string>> = {
  SOLANA: "/tracker/net-sol.svg",
  ETHEREUM: "/tracker/net-eth.svg",
  BASE: "/tracker/net-base.svg",
  BSC: "/tracker/net-bnb.svg",
};

/**
 * Onde o "Buy" abre o token (decisão 2026-10-01: Axiom). A Axiom é só Solana;
 * nos tokens EVM o link cai no GMGN, que cobre ETH/Base/BNB. No Solana o
 * usuário pode trocar para o GMGN no "Quick buy".
 */
export function buyUrl(chain: TrackerChain, mint: string, solanaTerminal: "axiom" | "gmgn" = "axiom"): string {
  const m = encodeURIComponent(mint);
  if (chain === "SOLANA") {
    return solanaTerminal === "gmgn" ? `https://gmgn.ai/sol/token/${m}` : `https://axiom.trade/t/${m}`;
  }
  const gmgn: Partial<Record<TrackerChain, string>> = { ETHEREUM: "eth", BASE: "base", BSC: "bsc" };
  return `https://gmgn.ai/${gmgn[chain] ?? "eth"}/token/${m}`;
}
