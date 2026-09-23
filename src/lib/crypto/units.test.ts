import { describe, expect, it } from "vitest";

import { toBaseUnits } from "./units";

describe("toBaseUnits", () => {
  it("converte sem float, nas casas do token", () => {
    expect(toBaseUnits("50", 6)).toBe(BigInt(50_000_000));
    expect(toBaseUnits("50.012345", 6)).toBe(BigInt(50_012_345));
    expect(toBaseUnits("50.1", 6)).toBe(BigInt(50_100_000));
    // BSC (Binance-Peg, 18 casas): passa de 2^53 sem perder precisão.
    expect(toBaseUnits("50.012345", 18)).toBe(BigInt("50012345000000000000"));
  });

  it("recusa casas a mais em vez de arredondar", () => {
    expect(() => toBaseUnits("50.0123456", 6)).toThrow();
  });

  it("recusa formatos fora de número decimal simples", () => {
    for (const bad of ["", "-1", "1e3", "0x10", "50,1", ".5", "5.", "abc"]) {
      expect(() => toBaseUnits(bad, 6)).toThrow();
    }
  });
});
