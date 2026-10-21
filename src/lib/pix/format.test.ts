import { describe, expect, it } from "vitest";

import { formatBrl, formatFxRate } from "@/lib/pix/format";

describe("formatação", () => {
  it("formata reais e cotação", () => {
    expect(formatBrl(29568)).toBe("R$ 295,68");
    expect(formatBrl(100000)).toBe("R$ 1.000,00");
    expect(formatFxRate("5.913600")).toBe("5.9136");
  });
});
