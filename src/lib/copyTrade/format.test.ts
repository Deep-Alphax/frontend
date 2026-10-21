import { describe, expect, it } from "vitest";

import type { TrackerFeedItem, TrackerTrade } from "@/lib/api/tracker";
import {
  callPlace,
  chartGeometry,
  hitLabel,
  holdLabel,
  kolHandle,
  kolRole,
  multipleLabel,
  signedSol,
  sol,
  timelineEvents,
  tradesLabel,
} from "./format";

const NOW = Date.parse("2026-10-20T12:00:00Z");
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

const trade = (p: Partial<TrackerTrade>): TrackerTrade => ({
  id: "t1",
  side: "BUY",
  quoteSymbol: "SOL",
  quoteAmount: 1,
  usdValue: 150,
  mcUsd: 100_000,
  at: iso(10),
  relation: null,
  ...p,
});

const card = (p: Partial<TrackerFeedItem>): TrackerFeedItem => ({
  id: "c1",
  status: "bought_before",
  kol: { id: "k1", name: "Reef", handle: "reefcalls", relevance: 90 },
  token: { chain: "SOLANA", mint: "Mint1111111111", symbol: "KEKO", name: null, imageUrl: null, mcUsd: null },
  call: null,
  trades: [],
  pnlUsd: null,
  strike: null,
  lastActivityAt: iso(0),
  ...p,
});

describe("copy trade — números", () => {
  it("SOL com sinal tipográfico e casas pela grandeza", () => {
    expect(signedSol(312.4)).toBe("+312 SOL");
    expect(signedSol(16.34)).toBe("+16.3 SOL");
    expect(signedSol(-0.8)).toBe("−0.8 SOL");
    expect(signedSol(0.6)).toBe("+0.6 SOL");
    expect(signedSol(0)).toBe("0 SOL");
    expect(signedSol(0.001)).toBe("0 SOL");
    expect(signedSol(97, false)).toBe("+97");
    expect(sol(3.62)).toBe("3.6 SOL");
    expect(sol(null)).toBe("—");
  });

  it("acerto e holding", () => {
    expect(hitLabel(58)).toBe("58%");
    expect(hitLabel(null)).toBe("—");
    expect(holdLabel(125 * 60_000)).toBe("2 h 05 min");
    expect(holdLabel(45 * 60_000)).toBe("45 min");
    expect(holdLabel(120 * 60_000)).toBe("2 h");
    expect(holdLabel(20_000)).toBe("< 1 min");
    expect(holdLabel(76 * 3_600_000)).toBe("3 d 4 h");
    expect(holdLabel(48 * 3_600_000)).toBe("2 d");
    expect(holdLabel(null)).toBe("—");
  });

  it("identidade do KOL", () => {
    expect(kolHandle({ handle: "reefcalls", name: "Reef" })).toBe("@reefcalls");
    expect(kolHandle({ handle: null, name: "Reef" })).toBe("Reef");
    expect(kolRole(["sniper", "whale"])).toBe("Sniper");
    expect(kolRole([])).toBeNull();
    expect(kolRole(["unknown-type"])).toBeNull();
    expect(tradesLabel({ stats: null })).toBe("0 trades 30d");
    expect(multipleLabel(3.24)).toBe("3.2x");
    expect(multipleLabel(12.6)).toBe("13x");
  });
});

describe("copy trade — linha do tempo", () => {
  it("achata trades e calls, do mais novo ao mais antigo", () => {
    const events = timelineEvents([
      card({
        trades: [
          trade({ id: "b1", at: iso(30), mcUsd: 100_000 }),
          trade({ id: "s1", side: "SELL", at: iso(5), mcUsd: 320_000, quoteAmount: 3 }),
        ],
        call: { messageId: "m1", text: "Holders clean", platform: "TELEGRAM", group: "Reef Calls", at: iso(20) },
      }),
      card({
        id: "c2",
        token: { chain: "SOLANA", mint: "Mint2222222222", symbol: null, name: null, imageUrl: null, mcUsd: null },
        trades: [trade({ id: "b2", at: iso(1) })],
      }),
    ]);
    expect(events.map((e) => e.id)).toEqual(["b2", "s1", "call:m1", "b1"]);
    const sell = events[1];
    expect(sell.kind).toBe("sell");
    if (sell.kind === "sell") expect(sell.multiple).toBeCloseTo(3.2);
    // token sem símbolo vira contrato abreviado
    expect(events[0].token).toBe("Mint…2222");
  });

  it("venda sem MC de compra fica sem múltiplo", () => {
    const [e] = timelineEvents([card({ trades: [trade({ side: "SELL", mcUsd: 50_000 })] })]);
    expect(e.kind === "sell" && e.multiple).toBeNull();
  });

  it("respeita o limite", () => {
    const many = Array.from({ length: 5 }, (_, i) => trade({ id: `t${i}`, at: iso(i) }));
    expect(timelineEvents([card({ trades: many })], 3)).toHaveLength(3);
  });

  it("onde foi a call", () => {
    expect(callPlace({ group: "Reef Calls", platform: "TELEGRAM" })).toBe("Reef Calls");
    expect(callPlace({ group: null, platform: "PUMPFUN" })).toBe("pump.fun");
  });
});

describe("copy trade — gráfico", () => {
  it("só positivo: zero na base, último ponto no topo", () => {
    const g = chartGeometry([0, 5, 10]);
    expect(g.zeroY).toBe(144);
    expect(g.last).toEqual({ x: 386, y: 26 });
    expect(g.line.startsWith("M2 144")).toBe(true);
    expect(g.area.endsWith("Z")).toBe(true);
    expect(g.grid).toEqual([26, 85, 144]);
  });

  it("negativo sobe o zero e desce abaixo dele", () => {
    const g = chartGeometry([0, -10, 10]);
    expect(g.zeroY).toBe(85);
    expect(g.line).toContain("L194 144");
  });

  it("série vazia ou plana não quebra", () => {
    expect(chartGeometry([]).last).toEqual({ x: 2, y: 144 });
    expect(chartGeometry([0, 0, 0]).zeroY).toBe(144);
  });
});
