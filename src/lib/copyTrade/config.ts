import type { CopyConfig, CopyDecision, CopyStatus, CopyView } from "@/lib/api/copyTrade";
import { compactUsd } from "@/lib/tracker/format";
import { signedSol, sol } from "@/lib/copyTrade/format";

/*
 * Regras de exibição do copy (drawer, coluna da esquerda, feed e 3ª coluna).
 * O padrão espelha `backend/src/app/copy-trade/engine/copy-config.ts` — o
 * servidor é quem valida e limita; aqui só o que a tela mostra.
 */

export const DEFAULT_COPY_CONFIG: CopyConfig = {
  v: 1,
  buy: { mode: "match", amountSol: 0.5, percent: 10 },
  sell: {
    mode: "follow",
    targets: [
      { kind: "profit", atPct: 100, sellPct: 50 },
      { kind: "profit", atPct: 300, sellPct: 100 },
      { kind: "loss", atPct: -50, sellPct: 100 },
    ],
  },
  protection: { minDeepScore: 60, skipIfDevSold: false, maxBundlePct: null, pauseOnLossPct24h: null },
  filters: { mcMinUsd: 50_000, mcMaxUsd: 5_000_000, liqMinUsd: 20_000, maxBuysPerDay: 5, oncePerToken: true },
  execution: { priorityFeeSol: 0.008, antiMev: true, slippageBps: 1500 },
};

/** Atalhos do campo de valor (Figma "campo - valor"). */
export const AMOUNT_PRESETS = [0.1, 0.25, 0.5, 1] as const;

/** Reserva que o servidor guarda para taxas — o campo fica vermelho acima do saldo menos isto. */
export const FEE_RESERVE_SOL = 0.02;

/** "Same amount as him, up to 0.5 SOL" — linha do item na esquerda e "Buy:" no Seu copy. */
export function describeBuy(c: CopyConfig): string {
  const v = sol(c.buy.amountSol);
  if (c.buy.mode === "fixed") return `${v} fixed`;
  if (c.buy.mode === "percent") return `${c.buy.percent}% of his amount, up to ${v}`;
  return `Same amount as him, up to ${v}`;
}

export function describeSell(c: CopyConfig): string {
  if (c.sell.mode === "none") return "Doesn't sell";
  if (c.sell.mode === "targets") {
    const n = c.sell.targets.length;
    return `My targets (${n} ${n === 1 ? "rule" : "rules"})`;
  }
  return "Sells together with him";
}

/** Rodapé do campo de valor, conforme o modo. */
export function buyHint(c: CopyConfig): string {
  if (c.buy.mode === "fixed") return "Buys this amount on every buy he makes.";
  if (c.buy.mode === "percent") return `Buys ${c.buy.percent}% of what he buys, up to this cap.`;
  return "Buys the same amount as him, up to this cap.";
}

/** Resumo dos acordeões fechados ("Score 60+, MC $50k a $5M, até 5 por dia"). */
export function protectionSummary(c: CopyConfig): string {
  const parts: string[] = [];
  if (c.protection.minDeepScore != null) parts.push(`Score ${c.protection.minDeepScore}+`);
  if (c.protection.pauseOnLossPct24h != null) parts.push(`pause at −${c.protection.pauseOnLossPct24h}% in 24 h`);
  return parts.length ? parts.join(", ") : "Off";
}

export function filtersSummary(c: CopyConfig): string {
  const f = c.filters;
  const parts: string[] = [];
  if (f.mcMinUsd != null || f.mcMaxUsd != null) {
    parts.push(`MC ${f.mcMinUsd != null ? compactUsd(f.mcMinUsd) : "$0"} to ${f.mcMaxUsd != null ? compactUsd(f.mcMaxUsd) : "any"}`);
  }
  if (f.maxBuysPerDay != null) parts.push(`up to ${f.maxBuysPerDay} a day`);
  return parts.length ? parts.join(", ") : "Off";
}

export function executionSummary(c: CopyConfig): string {
  const fee = `Priority ${c.execution.priorityFeeSol.toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL`;
  return c.execution.antiMev ? `${fee}, anti-MEV` : fee;
}

/** Valor por compra acima do que a W1 tem (estado "Saldo insuficiente"). */
export function exceedsBalance(c: CopyConfig, balanceSol: number | null | undefined): boolean {
  if (balanceSol == null) return false;
  return c.buy.amountSol + FEE_RESERVE_SOL + c.execution.priorityFeeSol > balanceSol;
}

/** Erros que barram "Start copying" antes de ir ao servidor. */
export function configErrors(c: CopyConfig): string[] {
  const errs: string[] = [];
  if (!(c.buy.amountSol >= 0.01)) errs.push("Minimum per buy is 0.01 SOL.");
  if (c.sell.mode === "targets" && !c.sell.targets.length) errs.push("Add at least one target.");
  for (const t of c.sell.targets) {
    if (t.kind === "profit" && !(t.atPct > 0)) errs.push("Profit targets must be above 0%.");
    if (t.kind === "loss" && !(t.atPct < 0 && t.atPct > -100)) errs.push("Loss limits must be between −1% and −99%.");
    if (!(t.sellPct >= 1 && t.sellPct <= 100)) errs.push("Sell between 1% and 100%.");
  }
  const f = c.filters;
  if (f.mcMinUsd != null && f.mcMaxUsd != null && f.mcMinUsd > f.mcMaxUsd) {
    errs.push("Minimum market cap is above the maximum.");
  }
  return [...new Set(errs)];
}

// ───────────────────────────── Status ─────────────────────────────

export type StatusTone = "green" | "red" | "orange" | "gray";

/** Bolinha e linha de status do item na esquerda. */
export function copyStatus(c: Pick<CopyView, "status" | "stopReason" | "config">): { label: string; tone: StatusTone } {
  if (c.status === "PAUSED") return { label: "Paused", tone: "orange" };
  if (c.status === "ENDED") return { label: "Ended", tone: "gray" };
  if (c.status === "STOPPED") {
    return c.stopReason === "LOSS_LIMIT"
      ? { label: "Stopped by loss limit", tone: "red" }
      : { label: "Stopped: low balance", tone: "red" };
  }
  return { label: describeBuy(c.config), tone: "green" };
}

/** "copying for 12 days" / "paused 1 day ago"… — cabeçalho do "Your copy". */
export function statusSince(status: CopyStatus, statusAt: string, createdAt: string, now = Date.now()): string {
  const days = (iso: string) => Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
  const hours = (iso: string) => Math.max(0, Math.floor((now - Date.parse(iso)) / 3_600_000));
  const ago = (iso: string) => {
    const d = days(iso);
    if (d >= 1) return `${d} ${d === 1 ? "day" : "days"}`;
    const h = hours(iso);
    return h >= 1 ? `${h} ${h === 1 ? "hour" : "hours"}` : "a few minutes";
  };
  if (status === "PAUSED") return `paused ${ago(statusAt)} ago`;
  if (status === "STOPPED") return `stopped ${ago(statusAt)} ago`;
  if (status === "ENDED") return `ended ${ago(statusAt)} ago`;
  return `copying for ${ago(createdAt)}`;
}

// ───────────────────────────── Decisões ─────────────────────────────

export type DecisionTone = "green" | "red" | "gray" | "yellow";

/**
 * O que aconteceu com você numa ação da carteira ("chip - você" e coluna
 * "Seu resultado"). SHADOW é simulado — usa o condicional ("You would buy").
 */
export function decisionLabel(e: {
  side: "BUY" | "SELL";
  decision: CopyDecision;
  reason: string | null;
  planSol: number | null;
  filledSol: number | null;
  pnlSol: number | null;
}): { text: string; tone: DecisionTone; dashed?: boolean } {
  const buy = e.side === "BUY";
  switch (e.decision) {
    case "COPIED":
      return buy
        ? { text: `You bought ${sol(e.filledSol ?? e.planSol)}`, tone: "green" }
        : { text: `You sold too ${signedSol(e.pnlSol ?? 0)}`, tone: (e.pnlSol ?? 0) >= 0 ? "green" : "red" };
    case "SHADOW":
      return buy
        ? { text: `You would buy ${sol(e.filledSol ?? e.planSol)}`, tone: "yellow" }
        : { text: `You would sell ${signedSol(e.pnlSol ?? 0)}`, tone: "yellow" };
    case "PENDING":
    case "EXECUTING":
      return { text: buy ? "Buying…" : "Selling…", tone: "yellow" };
    case "FAILED":
      return { text: "Failed: not executed", tone: "red" };
    case "IGNORED":
      return { text: `Skipped: ${reasonText(e.reason)}`, tone: "gray", dashed: true };
    case "NOT_COPIED":
      if (e.reason === "paused") return { text: "Paused: not copied", tone: "gray", dashed: true };
      return { text: `Not copied: ${reasonText(e.reason)}`, tone: "red" };
  }
}

/** Motivo de máquina → texto curto. */
export function reasonText(reason: string | null): string {
  if (!reason) return "rule";
  const score = /^deep_score:(\d+)$/.exec(reason);
  if (score) return `Deep Score ${score[1]}`;
  const map: Record<string, string> = {
    deep_score_unknown: "no Deep Score",
    low_balance: "low balance",
    "stopped:loss_limit": "loss limit",
    daily_limit: "daily limit",
    already_bought: "already bought",
    amount_too_small: "amount too small",
    mc_below_min: "MC below min",
    mc_above_max: "MC above max",
    mc_unknown: "no MC",
    liquidity_below_min: "low liquidity",
    liquidity_unknown: "no liquidity data",
    manual_sell: "you sell manually",
    own_targets: "your targets decide",
    balance_unavailable: "balance unavailable",
    daily_cap: "daily cap",
    execution_off: "execution off",
    no_position: "no position",
  };
  return map[reason] ?? reason.replace(/_/g, " ");
}
