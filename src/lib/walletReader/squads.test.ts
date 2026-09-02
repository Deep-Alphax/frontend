import { describe, it, expect } from "vitest";

import { dedupSquads, formatSquads, squadKey } from "./squads";

describe("squadKey", () => {
  it("ignora caixa e espaços nas pontas", () => {
    expect(squadKey("  Lair ")).toBe("lair");
    expect(squadKey("LAIR")).toBe(squadKey("lair"));
  });

  it("não junta nomes diferentes", () => {
    expect(squadKey("Lair")).not.toBe(squadKey("Lair 2"));
  });
});

describe("dedupSquads", () => {
  it("preserva ordem e a grafia da primeira ocorrência", () => {
    // A do preset vem primeiro, então é a dela que o usuário vê.
    expect(dedupSquads(["Lair", "Pastel Alpha", "lair"])).toEqual(["Lair", "Pastel Alpha"]);
  });

  it("apara os espaços e descarta nome vazio", () => {
    expect(dedupSquads([" Lair ", "", "   ", "Pastel"])).toEqual(["Lair", "Pastel"]);
  });

  it("lista vazia continua vazia", () => {
    expect(dedupSquads([])).toEqual([]);
  });

  it("não altera a lista recebida", () => {
    const input = ["b", "a", "b"];
    dedupSquads(input);
    expect(input).toEqual(["b", "a", "b"]);
  });
});

describe("formatSquads", () => {
  it("junta com vírgula — Squad1, Squad2, Squad3", () => {
    expect(formatSquads(["Squad1", "Squad2", "Squad3"])).toBe("Squad1, Squad2, Squad3");
  });

  it("um squad só sai sem vírgula", () => {
    expect(formatSquads(["Lair"])).toBe("Lair");
  });

  it("sem squad, avisa em vez de deixar o espaço vazio", () => {
    expect(formatSquads([])).toBe("Sem squad");
    expect(formatSquads([], "—")).toBe("—");
  });

  it("não repete o mesmo squad escrito de formas diferentes", () => {
    expect(formatSquads(["Lair", "lair ", "Pastel"])).toBe("Lair, Pastel");
  });
});
