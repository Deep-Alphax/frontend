import { describe, expect, it } from "vitest";

import type { CopyConfig } from "@/lib/api/copyTrade";
import {
  DEFAULT_COPY_CONFIG,
  configErrors,
  copyStatus,
  decisionLabel,
  describeBuy,
  describeSell,
  exceedsBalance,
  executionSummary,
  filtersSummary,
  protectionSummary,
  reasonText,
  statusSince,
} from "./config";

const cfg = (over: Partial<CopyConfig> = {}): CopyConfig => ({ ...DEFAULT_COPY_CONFIG, ...over });
const ev = (over: Partial<Parameters<typeof decisionLabel>[0]> = {}) => ({
  side: "BUY" as const,
  decision: "COPIED" as const,
  reason: null,
  planSol: 0.5,
  filledSol: 0.5,
  pnlSol: null,
  ...over,
});

describe("copy config — textos", () => {
  it("descreve compra e venda como no Figma (em inglês)", () => {
    expect(describeBuy(cfg())).toBe("Same amount as him, up to 0.5 SOL");
    expect(describeBuy(cfg({ buy: { mode: "percent", amountSol: 2, percent: 10 } }))).toBe(
      "10% of his amount, up to 2 SOL",
    );
    expect(describeBuy(cfg({ buy: { mode: "fixed", amountSol: 0.25, percent: 10 } }))).toBe("0.25 SOL fixed");
    expect(describeSell(cfg())).toBe("Sells together with him");
    expect(describeSell(cfg({ sell: { mode: "none", targets: [] } }))).toBe("Doesn't sell");
  });

  it("resumos dos acordeões", () => {
    expect(protectionSummary(cfg())).toBe("Score 60+");
    expect(filtersSummary(cfg())).toBe("MC $50k to $5M, up to 5 a day");
    expect(executionSummary(cfg())).toBe("Priority 0.008 SOL, anti-MEV");
  });

  it("saldo insuficiente considera reserva e prioridade", () => {
    expect(exceedsBalance(cfg(), 0.52)).toBe(true);
    expect(exceedsBalance(cfg(), 0.6)).toBe(false);
    expect(exceedsBalance(cfg(), null)).toBe(false);
  });

  it("erros de config", () => {
    expect(configErrors(cfg())).toEqual([]);
    expect(configErrors(cfg({ sell: { mode: "targets", targets: [] } }))).toContain("Add at least one target.");
    expect(
      configErrors(cfg({ filters: { ...DEFAULT_COPY_CONFIG.filters, mcMinUsd: 9e6, mcMaxUsd: 1e6 } })),
    ).toContain("Minimum market cap is above the maximum.");
    expect(
      configErrors(cfg({ sell: { mode: "targets", targets: [{ kind: "loss", atPct: 20, sellPct: 100 }] } })),
    ).toContain("Loss limits must be between −1% and −99%.");
  });
});

describe("copy — status e decisões", () => {
  it("status do item", () => {
    expect(copyStatus({ status: "STOPPED", stopReason: "LOW_BALANCE", config: cfg() })).toEqual({
      label: "Stopped: low balance",
      tone: "red",
    });
    expect(copyStatus({ status: "PAUSED", stopReason: null, config: cfg() }).tone).toBe("orange");
    expect(copyStatus({ status: "ACTIVE", stopReason: null, config: cfg() }).label).toBe(
      "Same amount as him, up to 0.5 SOL",
    );
  });

  it("há quanto tempo", () => {
    const now = Date.parse("2026-10-20T12:00:00Z");
    expect(statusSince("ACTIVE", "", "2026-10-08T12:00:00Z", now)).toBe("copying for 12 days");
    expect(statusSince("STOPPED", "2026-10-20T10:00:00Z", "", now)).toBe("stopped 2 hours ago");
    expect(statusSince("PAUSED", "2026-10-19T12:00:00Z", "", now)).toBe("paused 1 day ago");
  });

  it("chip do que aconteceu com você", () => {
    expect(decisionLabel(ev())).toEqual({ text: "You bought 0.5 SOL", tone: "green" });
    expect(decisionLabel(ev({ side: "SELL", pnlSol: 0.22 }))).toEqual({ text: "You sold too +0.22 SOL", tone: "green" });
    expect(decisionLabel(ev({ side: "SELL", pnlSol: -0.15 })).tone).toBe("red");
    expect(decisionLabel(ev({ decision: "IGNORED", reason: "deep_score:48" }))).toEqual({
      text: "Skipped: Deep Score 48",
      tone: "gray",
      dashed: true,
    });
    expect(decisionLabel(ev({ decision: "NOT_COPIED", reason: "low_balance" }))).toEqual({
      text: "Not copied: low balance",
      tone: "red",
    });
    expect(decisionLabel(ev({ decision: "NOT_COPIED", reason: "paused" })).text).toBe("Paused: not copied");
    expect(decisionLabel(ev({ decision: "SHADOW" })).text).toBe("You would buy 0.5 SOL");
  });

  it("motivo desconhecido não quebra", () => {
    expect(reasonText("something_new")).toBe("something new");
    expect(reasonText(null)).toBe("rule");
  });
});
