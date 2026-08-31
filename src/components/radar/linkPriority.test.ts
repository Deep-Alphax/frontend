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

  it("mantém UM link por provedor: o que carrega o CA", () => {
    const ca = "FK7nFZyuRELd7o8Xxvpump";
    const { primary, rest } = splitPriorityLinks(
      [
        "https://solscan.io/account/9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
        `https://solscan.io/token/${ca}`,
        "https://solscan.io/tx/5Xy",
        `https://gmgn.ai/sol/token/${ca}`,
      ],
      ca,
    );

    expect(primary.map((p) => p.link)).toEqual([
      `https://gmgn.ai/sol/token/${ca}`,
      `https://solscan.io/token/${ca}`,
    ]);
    // Os outros solscan viram "+N" (modal), não chip.
    expect(rest).toEqual([
      "https://solscan.io/account/9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
      "https://solscan.io/tx/5Xy",
    ]);
  });

  it("sem CA que case, fica o primeiro do provedor", () => {
    const { primary, rest } = splitPriorityLinks(
      ["https://solscan.io/tx/5Xy", "https://solscan.io/account/9xQe"],
      "NaoApareceEmLugarNenhum",
    );

    expect(primary.map((p) => p.link)).toEqual(["https://solscan.io/tx/5Xy"]);
    expect(rest).toEqual(["https://solscan.io/account/9xQe"]);
  });

  it("link repetido idêntico entra uma vez só", () => {
    const l = "https://axiom.trade/t/FK7n";
    const { primary, rest } = splitPriorityLinks([l, l]);
    expect(primary).toHaveLength(1);
    expect(rest).toEqual([]);
  });

  it("sem link priorizado devolve tudo em rest (chamador usa o padrão)", () => {
    const links = ["https://pump.fun/FK7n", "não é url"];
    const { primary, rest } = splitPriorityLinks(links);
    expect(primary).toEqual([]);
    expect(rest).toEqual(links);
  });
});
