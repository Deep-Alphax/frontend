import type { DevStats, LaunchRow, SnipeConfig, SnipeRule, SnipeRuleKind, SnipeView } from "@/lib/api/devSnipe";
import { multipleLabel, sol } from "@/lib/copyTrade/format";

/*
 * Regras de exibição do Dev Snipe (drawer, coluna da esquerda, cards e
 * tabela). O padrão espelha `backend/src/app/copy-trade/snipe/snipe-config.ts`
 * — o servidor valida e limita; aqui só o que a tela mostra e o que barra o
 * botão antes de ir ao servidor. UI em inglês (decisão 2026-09-28).
 */

/** Padrão do design (drawer 1646:36277): 0,5 SOL, 1 token, sem venda, slippage auto. */
export const DEFAULT_SNIPE_CONFIG: SnipeConfig = {
  v: 1,
  amountSol: 0.5,
  maxTokens: 1,
  sell: { mode: "none", rules: [] },
  execution: { slippageBps: null, priorityFeeSol: 0.008, antiMev: true },
};

/** Regras sugeridas ao escolher "My rules" sem nenhuma (as do Figma 1646:36663). */
export const SEED_RULES: SnipeRule[] = [
  { kind: "tp", atPct: 100, sellPct: 50 },
  { kind: "tp", atPct: 300, sellPct: 100 },
  { kind: "sl", atPct: -50, sellPct: 100 },
];

/** Teto de linhas no "When to sell" — a lista fica legível e o payload pequeno. */
export const MAX_RULES = 10;
/** Atraso máximo de uma venda (s). */
export const MAX_DELAY_S = 600;

export const newSnipeConfig = (): SnipeConfig => structuredClone(DEFAULT_SNIPE_CONFIG);

export type RuleTone = "green" | "red" | "blue" | "violet";

export interface RuleMeta {
  /** Texto do chip da linha (84 px). */
  chip: string;
  /** Nome no menu "+ Add rule". */
  name: string;
  /** Apoio do item no menu. */
  hint: string;
  tone: RuleTone;
  group: "price" | "events";
}

/** Chips da linha de regra (Figma 1661:42194) e itens do menu "+ Add rule". */
export const RULE_META: Record<SnipeRuleKind, RuleMeta> = {
  tp: { chip: "Profit", name: "Profit", hint: "Sell when the price is up X%", tone: "green", group: "price" },
  sl: { chip: "Loss", name: "Loss", hint: "Sell when the price is down X%", tone: "red", group: "price" },
  trail_tp: {
    chip: "Trailing",
    name: "Trailing take-profit",
    hint: "In profit, follows the top and sells on a pullback",
    tone: "blue",
    group: "price",
  },
  trail_sl: {
    chip: "Trailing",
    name: "Trailing stop-loss",
    hint: "Sells if it drops X% from the highest price",
    tone: "red",
    group: "price",
  },
  dev_sold: { chip: "Dev sold", name: "Dev sold", hint: "Sells as soon as the dev sells", tone: "violet", group: "events" },
  migrated: { chip: "Migrated", name: "Migrated", hint: "Sells when it leaves the bonding curve", tone: "violet", group: "events" },
  delay: { chip: "Delay", name: "Delay", hint: "Waits before every sale (one per snipe)", tone: "violet", group: "events" },
};

/** Ordem do menu: Price e Events. */
export const RULE_MENU: Record<"price" | "events", SnipeRuleKind[]> = {
  price: ["tp", "sl", "trail_tp", "trail_sl"],
  events: ["dev_sold", "migrated", "delay"],
};

/** Linha nova de cada tipo, com os valores do recorte do Figma. */
export function defaultRule(kind: SnipeRuleKind): SnipeRule {
  switch (kind) {
    case "tp":
      return { kind, atPct: 100, sellPct: 50 };
    case "sl":
      return { kind, atPct: -50, sellPct: 100 };
    case "trail_tp":
      return { kind, pullbackPct: 20, sellPct: 100 };
    case "trail_sl":
      return { kind, dropPct: 30, sellPct: 100 };
    case "delay":
      return { kind, minS: 5, maxS: 30 };
    case "dev_sold":
      return { kind, sellPct: 100 };
    case "migrated":
      return { kind, sellPct: 100 };
  }
}

/** O Atraso é um ajuste GERAL: no máximo um por snipe. */
export function canAddRule(rules: SnipeRule[], kind: SnipeRuleKind): boolean {
  if (rules.length >= MAX_RULES) return false;
  return kind !== "delay" || !rules.some((r) => r.kind === "delay");
}

/** Acrescenta a regra no fim (ou devolve a lista igual se não cabe). */
export function addRule(rules: SnipeRule[], kind: SnipeRuleKind): SnipeRule[] {
  return canAddRule(rules, kind) ? [...rules, defaultRule(kind)] : rules;
}

const int = (v: number) => Number.isFinite(v) && Number.isInteger(v);

/** Erros que barram "Activate Dev Snipe" antes de ir ao servidor. */
export function snipeErrors(c: SnipeConfig): string[] {
  const errs: string[] = [];
  if (!(Number.isFinite(c.amountSol) && c.amountSol > 0)) errs.push("Amount per snipe must be above 0 SOL.");
  if (c.maxTokens != null && !(int(c.maxTokens) && c.maxTokens >= 1)) errs.push("Stop after at least 1 token.");
  if (c.sell.mode === "rules") {
    const rules = c.sell.rules;
    if (!rules.some((r) => r.kind !== "delay")) errs.push("Add at least one sell rule.");
    if (rules.filter((r) => r.kind === "delay").length > 1) errs.push("Only one delay rule per snipe.");
    for (const r of rules) {
      switch (r.kind) {
        case "tp":
          if (!(r.atPct > 0)) errs.push("Profit rules must be above 0%.");
          break;
        case "sl":
          if (!(r.atPct < 0 && r.atPct > -100)) errs.push("Loss rules must be between −1% and −99%.");
          break;
        case "trail_tp":
          if (!(r.pullbackPct >= 1 && r.pullbackPct <= 99)) errs.push("Trailing pullback must be between 1% and 99%.");
          break;
        case "trail_sl":
          if (!(r.dropPct >= 1 && r.dropPct <= 99)) errs.push("Trailing drop must be between 1% and 99%.");
          break;
        case "delay":
          if (!(r.minS >= 0 && r.minS <= r.maxS && r.maxS <= MAX_DELAY_S)) {
            errs.push(`Delay must go from 0 to ${MAX_DELAY_S} s, shortest first.`);
          }
          break;
        default:
          break;
      }
      if ("sellPct" in r && !(r.sellPct >= 1 && r.sellPct <= 100)) errs.push("Sell between 1% and 100%.");
    }
  }
  const e = c.execution;
  if (!(Number.isFinite(e.priorityFeeSol) && e.priorityFeeSol >= 0)) errs.push("Priority fee can't be negative.");
  if (e.slippageBps != null && !(e.slippageBps >= 100 && e.slippageBps <= 5_000)) errs.push("Slippage must be between 1% and 50%.");
  return [...new Set(errs)];
}

/**
 * O que vai ao servidor: sem "My rules" a lista vai vazia (a escolha é "não
 * vender"); números arredondados para o que os campos aceitam.
 */
export function toPayload(c: SnipeConfig): SnipeConfig {
  return {
    ...c,
    maxTokens: c.maxTokens == null ? null : Math.round(c.maxTokens),
    sell: { mode: c.sell.mode, rules: c.sell.mode === "rules" ? c.sell.rules : [] },
  };
}

// ───────────────────────────── Resumos ─────────────────────────────

/** Acordeão "Snipes": "Stop after 1 token" / "No limit". */
export function snipesSummary(c: Pick<SnipeConfig, "maxTokens">): string {
  if (c.maxTokens == null) return "No limit";
  return `Stop after ${c.maxTokens} ${c.maxTokens === 1 ? "token" : "tokens"}`;
}

const fee = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** Acordeão "Execution": "Buy and sell: auto slippage, priority 0.008 SOL". */
export function executionSummary(c: Pick<SnipeConfig, "execution">): string {
  const e = c.execution;
  const slip = e.slippageBps == null ? "auto slippage" : `${fee(e.slippageBps / 100)}% slippage`;
  return `Buy and sell: ${slip}, priority ${fee(e.priorityFeeSol)} SOL`;
}

/** "0.5 SOL per token" — linha do item na esquerda. */
export function perTokenLabel(c: Pick<SnipeConfig, "amountSol">): string {
  return `${sol(c.amountSol)} per token`;
}

/** Lado direito do item "aguardando": "0 of 1" + "waiting" / "paused". */
export function waitingProgress(v: Pick<SnipeView, "sniped" | "status" | "config">): { count: string; state: string } {
  const max = v.config.maxTokens;
  return {
    count: max == null ? `${v.sniped} sniped` : `${v.sniped} of ${max}`,
    state: v.status === "PAUSED" ? "paused" : "waiting",
  };
}

/** Iniciais do dev: os 2 primeiros caracteres, como vêm ("DE", "Hx", "7G"). */
export function devInitials(addr: string): string {
  return addr.slice(0, 2);
}

/** Tempo relativo do Dev Snipe: "now", "2 min ago", "6 h ago", "1 day ago", "3 days ago". */
export function launchAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

/** Subtítulo do dev (card e "encontrado"). */
export function lastLaunchLabel(stats: DevStats | null, now = Date.now()): string {
  if (!stats || stats.tokens === 0) return "No launches on pump.fun yet";
  return stats.lastLaunchAt ? `Last launch ${launchAgo(stats.lastLaunchAt, now)}` : "No recent launch";
}

/** "42%" ou "—" (nenhum token em 30 dias). */
export function migrationRateLabel(stats: DevStats | null): string {
  return stats?.migrationRate == null ? "—" : `${Math.round(stats.migrationRate)}%`;
}

/** "18x" / "9.4x" ou "—". */
export function bestLabel(stats: DevStats | null): string {
  return stats?.bestMultiple == null ? "—" : multipleLabel(stats.bestMultiple);
}

/** Legenda das barrinhas: "5 of 12 migrated". */
export function migratedOfLabel(stats: Pick<DevStats, "migrated" | "tokens">): string {
  return `${stats.migrated} of ${stats.tokens} migrated`;
}

/** Coluna "Dev history" da tabela: "Migrated 4 of 12". */
export function devHistoryLabel(h: LaunchRow["devHistory"]): string {
  return `Migrated ${h.migrated} of ${h.tokens}`;
}

/** Coluna "Snipes": "You bought" (verde), "N snipes" (cinza) ou nada ("—"). */
export function snipesChip(row: Pick<LaunchRow, "snipes" | "mine">): { text: string; tone: "green" | "gray" } | null {
  if (row.mine) return { text: "You bought", tone: "green" };
  if (row.snipes > 0) return { text: `${row.snipes} ${row.snipes === 1 ? "snipe" : "snipes"}`, tone: "gray" };
  return null;
}

/**
 * Degradê do avatar do dev (card "Devs em alta"): par de cores escolhido por
 * hash do endereço — o mesmo dev sempre com a mesma cor. Pares do Figma.
 */
const GRADIENTS: Array<[string, string]> = [
  ["rgb(74, 92, 217)", "rgb(140, 64, 191)"],
  ["rgb(26, 140, 153)", "rgb(38, 89, 191)"],
  ["rgb(204, 102, 64)", "rgb(166, 51, 115)"],
  ["rgb(51, 140, 89)", "rgb(26, 102, 140)"],
  ["rgb(191, 140, 38)", "rgb(179, 64, 89)"],
  ["rgb(115, 77, 204)", "rgb(38, 128, 166)"],
];

export function devGradient(addr: string): string {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  const [a, b] = GRADIENTS[h % GRADIENTS.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 71.429%)`;
}
