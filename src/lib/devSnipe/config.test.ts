import { describe, expect, it } from "vitest";

import type { DevStats, SnipeConfig, SnipeRule } from "@/lib/api/devSnipe";
import {
  DEFAULT_SNIPE_CONFIG,
  MAX_RULES,
  SEED_RULES,
  addRule,
  bestLabel,
  canAddRule,
  defaultRule,
  devGradient,
  devHistoryLabel,
  devInitials,
  executionSummary,
  lastLaunchLabel,
  launchAgo,
  migratedOfLabel,
  migrationRateLabel,
  perTokenLabel,
  snipeErrors,
  snipesChip,
  snipesSummary,
  toPayload,
  waitingProgress,
} from "./config";

const cfg = (over: Partial<SnipeConfig> = {}): SnipeConfig => ({ ...structuredClone(DEFAULT_SNIPE_CONFIG), ...over });
const rules = (r: SnipeRule[]): Partial<SnipeConfig> => ({ sell: { mode: "rules", rules: r } });
const NOW = Date.parse("2026-10-22T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const stats = (p: Partial<DevStats> = {}): DevStats => ({
  tokens: 12,
  migrated: 5,
  migrationRate: 41.7,
  bestMultiple: 18.2,
  lastLaunchAt: ago(2 * 86_400_000),
  recent: [true, false],
  ...p,
});

describe("dev snipe config — padrão e resumos", () => {
  it("padrão do design", () => {
    expect(DEFAULT_SNIPE_CONFIG).toEqual({
      v: 1,
      amountSol: 0.5,
      maxTokens: 1,
      sell: { mode: "none", rules: [] },
      execution: { slippageBps: null, priorityFeeSol: 0.008, antiMev: true },
    });
    expect(snipeErrors(cfg())).toEqual([]);
  });

  it("resumos dos acordeões", () => {
    expect(snipesSummary({ maxTokens: 1 })).toBe("Stop after 1 token");
    expect(snipesSummary({ maxTokens: 3 })).toBe("Stop after 3 tokens");
    expect(snipesSummary({ maxTokens: null })).toBe("No limit");
    expect(executionSummary(cfg())).toBe("Buy and sell: auto slippage, priority 0.008 SOL");
    expect(executionSummary(cfg({ execution: { slippageBps: 1500, priorityFeeSol: 0.01, antiMev: false } }))).toBe(
      "Buy and sell: 15% slippage, priority 0.01 SOL",
    );
    expect(perTokenLabel({ amountSol: 0.5 })).toBe("0.5 SOL per token");
  });

  it("progresso do item aguardando", () => {
    expect(waitingProgress({ sniped: 0, status: "ACTIVE", config: cfg() })).toEqual({ count: "0 of 1", state: "waiting" });
    expect(waitingProgress({ sniped: 1, status: "PAUSED", config: cfg({ maxTokens: 3 }) })).toEqual({ count: "1 of 3", state: "paused" });
    expect(waitingProgress({ sniped: 2, status: "ACTIVE", config: cfg({ maxTokens: null }) }).count).toBe("2 sniped");
  });
});

describe("dev snipe config — regras", () => {
  it("linhas novas com os valores do recorte", () => {
    expect(defaultRule("trail_tp")).toEqual({ kind: "trail_tp", pullbackPct: 20, sellPct: 100 });
    expect(defaultRule("trail_sl")).toEqual({ kind: "trail_sl", dropPct: 30, sellPct: 100 });
    expect(defaultRule("delay")).toEqual({ kind: "delay", minS: 5, maxS: 30 });
    expect(defaultRule("dev_sold")).toEqual({ kind: "dev_sold", sellPct: 100 });
  });

  it("atraso só uma vez; acrescenta no fim; teto de linhas", () => {
    const one = addRule(SEED_RULES, "delay");
    expect(one).toHaveLength(4);
    expect(one[3].kind).toBe("delay");
    expect(canAddRule(one, "delay")).toBe(false);
    expect(addRule(one, "delay")).toBe(one);
    expect(addRule(one, "migrated").at(-1)).toEqual({ kind: "migrated", sellPct: 100 });

    const full = Array.from({ length: MAX_RULES }, () => defaultRule("tp"));
    expect(canAddRule(full, "sl")).toBe(false);
  });

  it("validação dos campos", () => {
    expect(snipeErrors(cfg({ amountSol: 0 }))).toContain("Amount per snipe must be above 0 SOL.");
    expect(snipeErrors(cfg({ maxTokens: 0 }))).toContain("Stop after at least 1 token.");
    expect(snipeErrors(cfg(rules([])))).toContain("Add at least one sell rule.");
    expect(snipeErrors(cfg(rules([defaultRule("delay")])))).toContain("Add at least one sell rule.");
    expect(snipeErrors(cfg(rules([{ kind: "tp", atPct: 0, sellPct: 50 }])))).toContain("Profit rules must be above 0%.");
    expect(snipeErrors(cfg(rules([{ kind: "sl", atPct: 10, sellPct: 50 }])))).toContain("Loss rules must be between −1% and −99%.");
    expect(snipeErrors(cfg(rules([{ kind: "trail_tp", pullbackPct: 100, sellPct: 50 }])))).toContain(
      "Trailing pullback must be between 1% and 99%.",
    );
    expect(snipeErrors(cfg(rules([{ kind: "trail_sl", dropPct: 0, sellPct: 50 }])))).toContain("Trailing drop must be between 1% and 99%.");
    expect(snipeErrors(cfg(rules([{ kind: "migrated", sellPct: 0 }])))).toContain("Sell between 1% and 100%.");
    expect(snipeErrors(cfg(rules([...SEED_RULES, { kind: "delay", minS: 40, maxS: 30 }])))).toContain(
      "Delay must go from 0 to 600 s, shortest first.",
    );
    expect(snipeErrors(cfg(rules([...SEED_RULES, { kind: "delay", minS: 0, maxS: 601 }])))).toHaveLength(1);
    expect(snipeErrors(cfg(rules([...SEED_RULES, defaultRule("delay"), defaultRule("delay")])))).toContain(
      "Only one delay rule per snipe.",
    );
    expect(snipeErrors(cfg(rules(SEED_RULES)))).toEqual([]);
    // Em "Don't sell" as regras guardadas não barram nada.
    expect(snipeErrors(cfg({ sell: { mode: "none", rules: [{ kind: "tp", atPct: -5, sellPct: 50 }] } }))).toEqual([]);
  });

  it("payload: sem 'My rules' a lista vai vazia", () => {
    expect(toPayload(cfg({ sell: { mode: "none", rules: SEED_RULES } })).sell).toEqual({ mode: "none", rules: [] });
    expect(toPayload(cfg(rules(SEED_RULES))).sell.rules).toHaveLength(3);
  });
});

describe("dev snipe — rótulos", () => {
  it("tempo relativo e último lançamento", () => {
    expect(launchAgo(ago(30_000), NOW)).toBe("now");
    expect(launchAgo(ago(2 * 60_000), NOW)).toBe("2 min ago");
    expect(launchAgo(ago(6 * 3_600_000), NOW)).toBe("6 h ago");
    expect(launchAgo(ago(86_400_000), NOW)).toBe("1 day ago");
    expect(lastLaunchLabel(stats(), NOW)).toBe("Last launch 2 days ago");
    expect(lastLaunchLabel(null, NOW)).toBe("No launches on pump.fun yet");
  });

  it("estatísticas do dev", () => {
    expect(migrationRateLabel(stats())).toBe("42%");
    expect(migrationRateLabel(stats({ migrationRate: null }))).toBe("—");
    expect(bestLabel(stats())).toBe("18x");
    expect(bestLabel(stats({ bestMultiple: 9.42 }))).toBe("9.4x");
    expect(bestLabel(null)).toBe("—");
    expect(migratedOfLabel(stats())).toBe("5 of 12 migrated");
    expect(devHistoryLabel({ migrated: 4, tokens: 12 })).toBe("Migrated 4 of 12");
  });

  it("chip de snipes da tabela", () => {
    expect(snipesChip({ snipes: 2, mine: false })).toEqual({ text: "2 snipes", tone: "gray" });
    expect(snipesChip({ snipes: 1, mine: false })).toEqual({ text: "1 snipe", tone: "gray" });
    expect(snipesChip({ snipes: 3, mine: true })).toEqual({ text: "You bought", tone: "green" });
    expect(snipesChip({ snipes: 0, mine: false })).toBeNull();
  });

  it("avatar: iniciais e degradê determinístico", () => {
    expect(devInitials("Hx9PqT2wQd")).toBe("Hx");
    expect(devGradient("DEVx9rQ4")).toBe(devGradient("DEVx9rQ4"));
    expect(devGradient("DEVx9rQ4")).toMatch(/^linear-gradient\(135deg, rgb/);
  });
});
