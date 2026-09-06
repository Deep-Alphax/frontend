import { describe, it, expect } from "vitest";

import {
  COL_DEFAULT,
  RAIL_W,
  clampColumn,
  fitPair,
  parseStoredWidth,
  roomFor,
} from "./columnWidth";

describe("roomFor", () => {
  it("desconta a rail do espaço disponível", () => {
    expect(roomFor(1440)).toBe(1440 - RAIL_W);
  });

  it("container ainda não medido não vira teto", () => {
    // 0 = "sem teto conhecido"; chutar um encolheria a coluna no 1º render.
    expect(roomFor(0)).toBe(0);
    expect(roomFor(NaN)).toBe(0);
    expect(roomFor(-10)).toBe(0);
  });

  it("container menor que a rail não devolve espaço negativo", () => {
    expect(roomFor(40)).toBe(0);
  });
});

describe("clampColumn", () => {
  it("não impõe piso: a coluna pode ir a zero", () => {
    // Era o limite de 260px que impedia encolher do jeito que se quisesse.
    expect(clampColumn(0, 1000)).toBe(0);
    expect(clampColumn(12, 1000)).toBe(12);
  });

  it("não impõe teto arbitrário: vai até o espaço que existe", () => {
    // Era o limite de 620px que impedia esticar.
    expect(clampColumn(900, 1000)).toBe(900);
    expect(clampColumn(1200, 1000)).toBe(1000);
  });

  it("largura negativa vira zero", () => {
    expect(clampColumn(-50, 1000)).toBe(0);
  });

  it("sem medida conhecida, respeita a escolha do usuário", () => {
    expect(clampColumn(2000, 0)).toBe(2000);
    expect(clampColumn(-1, 0)).toBe(0);
  });

  it("valor inválido cai no padrão", () => {
    expect(clampColumn(NaN, 1000)).toBe(COL_DEFAULT);
  });
});

describe("fitPair", () => {
  it("deixa as duas como estão quando cabem", () => {
    expect(fitPair(340, 340, 1371)).toEqual({ left: 340, right: 340 });
  });

  it("permite que as laterais tomem TODA a linha (central sumindo)", () => {
    expect(fitPair(600, 400, 1000)).toEqual({ left: 600, right: 400 });
  });

  it("nada escapa da linha quando a soma não cabe", () => {
    const { left, right } = fitPair(900, 900, 1000);
    expect(left + right).toBeLessThanOrEqual(1000);
    // Regra fixa: a esquerda tem prioridade e a direita fica com o resto.
    expect({ left, right }).toEqual({ left: 900, right: 100 });
  });

  it("uma lateral sozinha maior que a linha é aparada", () => {
    expect(fitPair(5000, 0, 1000)).toEqual({ left: 1000, right: 0 });
  });

  it("sem medida, não apara nada (só o negativo)", () => {
    expect(fitPair(800, 800, 0)).toEqual({ left: 800, right: 800 });
    expect(fitPair(-5, 800, 0)).toEqual({ left: 0, right: 800 });
  });

  it("janela estreitou e voltou: a escolha do usuário sobrevive", () => {
    // O clamp é só de exibição — o estado guarda a intenção.
    const escolha = { left: 700, right: 500 };
    expect(fitPair(escolha.left, escolha.right, 800)).toEqual({ left: 700, right: 100 });
    expect(fitPair(escolha.left, escolha.right, 1400)).toEqual({ left: 700, right: 500 });
  });
});

describe("parseStoredWidth", () => {
  it("zero é escolha válida — coluna escondida", () => {
    expect(parseStoredWidth("0")).toBe(0);
  });

  it("lê o valor gravado, inclusive fora dos antigos limites 260–620", () => {
    expect(parseStoredWidth("120")).toBe(120);
    expect(parseStoredWidth("1500")).toBe(1500);
  });

  it("ausente ou inválido cai no padrão", () => {
    expect(parseStoredWidth(null)).toBe(COL_DEFAULT);
    expect(parseStoredWidth("abc")).toBe(COL_DEFAULT);
    expect(parseStoredWidth("-30")).toBe(COL_DEFAULT);
  });
});
