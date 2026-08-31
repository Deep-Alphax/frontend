import { describe, expect, it } from "vitest";

import {
  DEFAULT_COLUMN_ORDER,
  moveColumn,
  normalizeOrder,
  shiftColumn,
  type RadarColumnKey,
} from "./columnOrder";

describe("normalizeOrder", () => {
  it("cai no padrão com valor inválido", () => {
    expect(normalizeOrder(null)).toEqual(DEFAULT_COLUMN_ORDER);
    expect(normalizeOrder("favorites")).toEqual(DEFAULT_COLUMN_ORDER);
  });

  it("descarta chave desconhecida/duplicada e completa o que falta", () => {
    expect(normalizeOrder(["favorites", "favorites", "xpto", 3])).toEqual([
      "favorites",
      "rick",
      "feed",
    ]);
  });

  it("preserva uma ordem válida", () => {
    const saved: RadarColumnKey[] = ["favorites", "feed", "rick"];
    expect(normalizeOrder(saved)).toEqual(saved);
  });
});

describe("moveColumn", () => {
  it("move a coluna para a posição do alvo", () => {
    expect(moveColumn(DEFAULT_COLUMN_ORDER, "favorites", "rick")).toEqual([
      "favorites",
      "rick",
      "feed",
    ]);
    expect(moveColumn(DEFAULT_COLUMN_ORDER, "rick", "favorites")).toEqual([
      "feed",
      "rick",
      "favorites",
    ]);
  });

  it("devolve o mesmo array quando nada muda", () => {
    expect(moveColumn(DEFAULT_COLUMN_ORDER, "rick", "rick")).toBe(DEFAULT_COLUMN_ORDER);
  });
});

describe("shiftColumn", () => {
  it("desloca uma posição", () => {
    expect(shiftColumn(DEFAULT_COLUMN_ORDER, "favorites", -1)).toEqual([
      "rick",
      "favorites",
      "feed",
    ]);
  });

  it("clampa nas bordas", () => {
    expect(shiftColumn(DEFAULT_COLUMN_ORDER, "rick", -1)).toBe(DEFAULT_COLUMN_ORDER);
    expect(shiftColumn(DEFAULT_COLUMN_ORDER, "favorites", 1)).toBe(DEFAULT_COLUMN_ORDER);
  });
});
