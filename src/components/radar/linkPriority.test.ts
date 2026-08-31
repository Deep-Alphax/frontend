import { describe, expect, it } from "vitest";

import { splitPriorityLinks } from "./linkPriority";

describe("splitPriorityLinks", () => {
  it("põe os provedores priorizados na ordem gmgn → axiom → dexscreener → solscan", () => {
    const { primary, rest } = splitPriorityLinks([
      "https://x.com/algum/status/1",
      "https://solscan.io/token/FK7n",
      "https://dexscreener.com/solana/FK7n",
      "https://axiom.trade/t/FK7n",
      "https://gmgn.ai/sol/token/FK7n",
      "https://pump.fun/FK7n",
    ]);

    expect(primary.map((p) => p.label)).toEqual(["GMGN", "AXIOM", "DEXSCREENER", "SOLSCAN"]);
    expect(rest).toEqual(["https://x.com/algum/status/1", "https://pump.fun/FK7n"]);
  });

  it("casa subdomínio e www, mas não host que apenas termina parecido", () => {
    const { primary, rest } = splitPriorityLinks([
      "https://www.dexscreener.com/solana/FK7n",
      "https://t.gmgn.ai/sol/token/FK7n",
      "https://fake-gmgn.ai/sol/token/FK7n",
    ]);

    expect(primary.map((p) => p.label)).toEqual(["GMGN", "DEXSCREENER"]);
    expect(rest).toEqual(["https://fake-gmgn.ai/sol/token/FK7n"]);
  });

  it("sem link priorizado devolve tudo em rest (chamador usa o padrão)", () => {
    const links = ["https://pump.fun/FK7n", "não é url"];
    const { primary, rest } = splitPriorityLinks(links);
    expect(primary).toEqual([]);
    expect(rest).toEqual(links);
  });
});
