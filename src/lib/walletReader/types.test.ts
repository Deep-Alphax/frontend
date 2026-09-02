import { describe, it, expect } from "vitest";

import {
  KOL_TIERS,
  KOL_TYPES,
  KOL_TYPE_MAP,
  avatarSrc,
  hashStr,
  memeAvatarFor,
  squadHue,
  tierFor,
} from "./types";

/**
 * Contrato dos níveis com o backend (`kol-index.service.ts`): os `id` e as
 * faixas TÊM que bater, senão o filtro por tier e as contagens da rail divergem
 * do que a lista mostra. Estes testes travam a tabela — mudá-la sem mexer no
 * backend quebra aqui antes de quebrar em produção.
 */
describe("KOL_TIERS", () => {
  it("cobre 0–100 sem buraco nem sobreposição", () => {
    const ordered = [...KOL_TIERS].sort((a, b) => a.min - b.min);
    expect(ordered[0].min).toBe(0);
    expect(ordered[ordered.length - 1].max).toBe(100);
    ordered.forEach((tier, i) => {
      expect(tier.min).toBeLessThanOrEqual(tier.max);
      if (i > 0) expect(tier.min).toBe(ordered[i - 1].max + 1);
    });
  });

  it("já vem em ordem crescente de relevância", () => {
    const mins = KOL_TIERS.map((t) => t.min);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });

  it("não repete id", () => {
    expect(new Set(KOL_TIERS.map((t) => t.id)).size).toBe(KOL_TIERS.length);
  });

  it("traz o skin completo do card em cada nível", () => {
    for (const tier of KOL_TIERS) {
      expect(tier.emblem).toMatch(/^\/wallet-reader\/tiers\/.+\.webp$/);
      for (const key of ["card", "ring", "bar", "corner", "pill", "pillText"] as const) {
        expect(tier[key], `${tier.id}.${key}`).toBeTruthy();
      }
    }
  });
});

describe("tierFor", () => {
  it("resolve um nível para toda relevância válida", () => {
    for (let score = 0; score <= 100; score++) {
      const tier = tierFor(score);
      expect(score, `score ${score}`).toBeGreaterThanOrEqual(tier.min);
      expect(score, `score ${score}`).toBeLessThanOrEqual(tier.max);
    }
  });

  it("acerta as bordas de cada faixa", () => {
    for (const tier of KOL_TIERS) {
      expect(tierFor(tier.min).id).toBe(tier.id);
      expect(tierFor(tier.max).id).toBe(tier.id);
    }
  });

  it("mapeia os extremos nos níveis certos", () => {
    expect(tierFor(0).id).toBe("wood");
    expect(tierFor(100).id).toBe("super-alpha");
  });

  it("cai no primeiro nível fora da escala (0–100 é o range da UI)", () => {
    expect(tierFor(-1).id).toBe(KOL_TIERS[0].id);
    expect(tierFor(101).id).toBe(KOL_TIERS[0].id);
  });
});

describe("KOL_TYPES", () => {
  it("não repete id", () => {
    expect(new Set(KOL_TYPES.map((t) => t.id)).size).toBe(KOL_TYPES.length);
  });

  it("o mapa cobre todos os tipos", () => {
    for (const t of KOL_TYPES) expect(KOL_TYPE_MAP[t.id]).toEqual(t);
    expect(Object.keys(KOL_TYPE_MAP)).toHaveLength(KOL_TYPES.length);
  });

  it("tipo desconhecido não quebra o mapa", () => {
    expect(KOL_TYPE_MAP["inexistente"]).toBeUndefined();
  });
});

describe("avatar do KOL", () => {
  it("é determinístico por id", () => {
    expect(memeAvatarFor("k1")).toBe(memeAvatarFor("k1"));
    expect(memeAvatarFor("k1")).toMatch(/^\/wallet-reader\/memes\/.+\.png$/);
  });

  it("distribui ids diferentes pelo pack", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `kol-${i}`);
    expect(new Set(ids.map(memeAvatarFor)).size).toBeGreaterThan(1);
  });

  it("a foto do usuário vence o avatar por hash", () => {
    expect(avatarSrc({ id: "k1", avatar: "data:image/jpeg;base64,AAA" })).toBe(
      "data:image/jpeg;base64,AAA",
    );
    expect(avatarSrc({ id: "k1", avatar: null })).toBe(memeAvatarFor("k1"));
    // String vazia = sem foto (é o que o backend grava quando o usuário limpa).
    expect(avatarSrc({ id: "k1", avatar: "" })).toBe(memeAvatarFor("k1"));
  });
});

describe("hashStr / squadHue", () => {
  it("hash é estável e nunca negativo", () => {
    expect(hashStr("Ansem")).toBe(hashStr("Ansem"));
    for (const s of ["", "a", "Ansem", "😀 unicode", "x".repeat(500)]) {
      expect(hashStr(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it("hue do squad fica dentro do círculo cromático", () => {
    for (const name of ["Lair", "Pastel Alpha", "squad-de-nome-longo", ""]) {
      const hue = squadHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });

  it("a cor do squad ignora caixa e espaços — mesmo nome, mesma cor", () => {
    expect(squadHue("  LAIR ")).toBe(squadHue("lair"));
  });
});
