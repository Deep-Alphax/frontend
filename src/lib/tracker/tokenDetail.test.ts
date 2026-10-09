import { describe, expect, it } from "vitest";

import type { TokenDetail } from "@/lib/api/tracker";
import {
  chartGeometry,
  contractLabel,
  exitBanner,
  holderBarWidth,
  holderPct,
  multipleLabel,
  ringStates,
  signalLabel,
  supplyLabel,
} from "./tokenDetail";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

const exit = (over: Partial<TokenDetail["exit"]> = {}): TokenDetail["exit"] => ({
  liquidityDrop: null,
  mcDropFromHigh: null,
  exitedKols: [],
  rugAt: null,
  stuckWallets: 0,
  ...over,
});

describe("drawer do token — exibição", () => {
  it("rótulo do sinal muda quando o estado é ruim (texto do Figma)", () => {
    expect(signalLabel("holders", "good")).toBe("Clean holders");
    expect(signalLabel("holders", "bad")).toBe("Concentrated holders");
    expect(signalLabel("liquidity", "bad")).toBe("Liquidity removed");
    expect(signalLabel("kols_bought", "bad")).toBe("KOLs bought");
    expect(signalLabel("rick", "unknown")).toBe("Rick approved");
  });

  it("anel: bons, depois ruins, depois apagados", () => {
    expect(
      ringStates([{ state: "off" }, { state: "bad" }, { state: "good" }, { state: "unknown" }, { state: "good" }]),
    ).toEqual(["good", "good", "bad", "off", "unknown"]);
  });

  describe("exitBanner", () => {
    it("estado normal não tem banner", () => {
      expect(exitBanner({ status: "normal", exit: exit() }, NOW)).toBeNull();
    });

    it("risco: o 1º fato vira o título, o resto o detalhe", () => {
      const b = exitBanner(
        {
          status: "risk",
          exit: exit({
            liquidityDrop: { pct: 0.62, minutes: 10 },
            mcDropFromHigh: 0.55,
            exitedKols: ["@obsidian"],
          }),
        },
        NOW,
      );
      expect(b).toEqual({
        title: "Exit signals: liquidity down 62% in 10 min",
        detail: "Market cap down 55% from the 1h high, @obsidian already exited. Be careful entering.",
      });
    });

    it("risco com um fato só e lista longa de saídas", () => {
      expect(exitBanner({ status: "risk", exit: exit({ mcDropFromHigh: 0.5 }) }, NOW)).toEqual({
        title: "Exit signals: market cap down 50% from the 1h high",
        detail: "Be careful entering.",
      });
      const b = exitBanner(
        { status: "risk", exit: exit({ mcDropFromHigh: 0.5, exitedKols: ["@a", "@b", "@c", "@d"] }) },
        NOW,
      );
      expect(b?.detail).toBe("@a, @b and 2 more already exited. Be careful entering.");
    });

    it("rug: quando e quantas carteiras ficaram presas", () => {
      expect(exitBanner({ status: "rugged", exit: exit({ rugAt: iso(1), stuckWallets: 4 }) }, NOW)).toEqual({
        title: "Token rugged: liquidity was removed 1 min ago",
        detail: "You can't buy or sell. 4 tracked wallets are stuck.",
      });
      expect(exitBanner({ status: "rugged", exit: exit({ rugAt: iso(3), stuckWallets: 1 }) }, NOW)?.detail).toBe(
        "You can't buy or sell. 1 tracked wallet is stuck.",
      );
    });
  });

  describe("chartGeometry", () => {
    it("menos de 2 pontos = sem gráfico", () => {
      expect(chartGeometry({ points: [{ t: iso(1), mc: 10 }], markers: [] })).toBeNull();
    });

    it("série crescente: tendência up, linha do canto inferior ao superior do traço", () => {
      const g = chartGeometry({
        points: [
          { t: iso(60), mc: 100 },
          { t: iso(30), mc: 150 },
          { t: iso(0), mc: 200 },
        ],
        markers: [
          { t: iso(30), kind: "gold" },
          { t: iso(90), kind: "call" }, // fora da série: descartado
        ],
      })!;
      expect(g.trend).toBe("up");
      expect(g.line).toBe("M8 126 L271 70 L534 14");
      expect(g.area).toBe("M8 126 L271 70 L534 14 L534 140 L8 140 Z");
      expect(g.markers).toEqual([{ kind: "gold", t: iso(30), left: 50, top: 50 }]);
    });

    it("série caindo = down; MC constante fica no meio", () => {
      expect(chartGeometry({ points: [{ t: iso(10), mc: 9 }, { t: iso(0), mc: 3 }], markers: [] })!.trend).toBe(
        "down",
      );
      expect(chartGeometry({ points: [{ t: iso(10), mc: 5 }, { t: iso(0), mc: 5 }], markers: [] })!.line).toBe(
        "M8 70 L534 70",
      );
    });
  });

  it("barra de holders: 15px por ponto num trilho de 317, teto de 300px", () => {
    expect(holderBarWidth(14)).toBe("max(2px, 66.25%)");
    expect(holderBarWidth(100)).toBe("max(2px, 94.64%)");
    expect(holderBarWidth(0)).toBe("max(2px, 0%)");
  });

  it("formatos: %, múltiplo, supply e contrato", () => {
    expect(holderPct(14)).toBe("14%");
    expect(holderPct(3.24)).toBe("3.2%");
    expect(multipleLabel(3.31)).toBe("3.3x");
    expect(multipleLabel(12.4)).toBe("12x");
    expect(supplyLabel(0.8)).toBe("0.8%");
    expect(supplyLabel(0.004)).toBe("<0.01%");
    expect(supplyLabel(0)).toBe("0%");
    expect(contractLabel("Fr0iNk7aQxxxxxxxxxxxxxxxxxxxxxxxxxxpump")).toBe("Fr0iNk7aQ…pump");
  });
});
