import { describe, expect, it } from "vitest";

import {
  backupFilename,
  chunkOverrides,
  KolBackupError,
  normalizeOverride,
  parseKolBackup,
  type KolImportOverride,
} from "./backup";

const PNG = "data:image/png;base64,iVBORw0KGgo=";

describe("parseKolBackup", () => {
  it("lê o formato do export (overrides como objeto por kolId)", () => {
    const text = JSON.stringify({
      version: 1,
      exportedAt: "2026-09-28T00:00:00.000Z",
      customIds: ["custom-1"],
      overrides: {
        k1: { name: "Ansem", relevance: 80, squads: ["Lair"], avatar: null, deleted: false },
        "custom-1": { name: "Meu KOL", walletsAdded: [{ name: "main", address: "So1" }] },
      },
    });
    const res = parseKolBackup(text);
    expect(res.skipped).toBe(0);
    expect(res.groups).toBeUndefined();
    expect(res.overrides).toEqual([
      { kolId: "k1", name: "Ansem", relevance: 80, squads: ["Lair"], avatar: null, deleted: false },
      { kolId: "custom-1", name: "Meu KOL", walletsAdded: [{ name: "main", address: "So1" }] },
    ]);
  });

  it("aceita overrides como lista com kolId", () => {
    const res = parseKolBackup(JSON.stringify({ overrides: [{ kolId: "k1", name: "A" }] }));
    expect(res.overrides).toEqual([{ kolId: "k1", name: "A" }]);
  });

  it("backup antigo (localStorage): descarta updatedAt e mantém groups + fnfGroups", () => {
    const res = parseKolBackup(
      JSON.stringify({
        overrides: { k1: { name: "A", fnfGroups: ["g1"], updatedAt: 1724650000000 } },
        groups: [{ id: "g1", name: "Lair" }],
      }),
    );
    expect(res.overrides).toEqual([{ kolId: "k1", name: "A", fnfGroups: ["g1"] }]);
    expect(res.groups).toEqual([{ id: "g1", name: "Lair" }]);
  });

  it("pula linhas sem conserto e conta quantas", () => {
    const res = parseKolBackup(
      JSON.stringify({ overrides: { k1: { name: "A" }, k2: "lixo", k3: null, k4: [] } }),
    );
    expect(res.overrides.map((o) => o.kolId)).toEqual(["k1"]);
    expect(res.skipped).toBe(3);
  });

  it("recusa arquivo que não é JSON", () => {
    expect(() => parseKolBackup("não é json")).toThrow(KolBackupError);
  });

  it("recusa JSON que não é backup de KOLs", () => {
    // O `wallets-selecionadas.txt` desta mesma tela é uma lista — não um backup.
    expect(() => parseKolBackup(JSON.stringify([{ trackedWalletAddress: "So1" }]))).toThrow(
      /not a KOL backup/,
    );
    expect(() => parseKolBackup(JSON.stringify({ foo: 1 }))).toThrow(KolBackupError);
  });
});

describe("parseKolBackup — export filtrado (lista kols)", () => {
  it("KOL sem edição vira 'cria se faltar'; o que tem edição vai só pelo override", () => {
    const file = JSON.stringify({
      version: 1,
      kols: [
        { id: "a", name: "A", relevance: 90, types: [], squads: ["Lair"], twitter: "a", notes: "", wallets: [{ name: "main", address: "So1" }] },
        { id: "b", name: "B", relevance: 20, types: [], squads: [], twitter: "", notes: "", wallets: [] },
      ],
      overrides: { b: { notes: "minha nota" } },
    });
    const { overrides } = parseKolBackup(file);
    expect(overrides).toEqual([
      { kolId: "b", notes: "minha nota" },
      {
        kolId: "a",
        name: "A",
        relevance: 90,
        types: [],
        squads: ["Lair"],
        twitter: "a",
        notes: "",
        walletsAdded: [{ name: "main", address: "So1" }],
        ifMissing: true,
      },
    ]);
  });

  it("arquivo só com kols (sem edições) não é mais recusado", () => {
    const { overrides } = parseKolBackup(JSON.stringify({ kols: [{ id: "x", name: "X" }], overrides: {} }));
    expect(overrides).toHaveLength(1);
    expect(overrides[0]).toMatchObject({ kolId: "x", ifMissing: true });
  });
});

describe("normalizeOverride", () => {
  it("mantém null (volta a herdar do preset) e omite o que falta", () => {
    expect(normalizeOverride("k1", { name: null, twitter: null })).toEqual({
      kolId: "k1",
      name: null,
      twitter: null,
    });
  });

  it("avatar: aceita raster e vazio; descarta svg, caminho e URL", () => {
    expect(normalizeOverride("k1", { avatar: PNG })?.avatar).toBe(PNG);
    expect(normalizeOverride("k1", { avatar: "" })?.avatar).toBe("");
    expect(normalizeOverride("k1", { avatar: "data:image/svg+xml;base64,PHN2Zz4=" })).not.toHaveProperty("avatar");
    expect(normalizeOverride("k1", { avatar: "/memes/doge.png" })).not.toHaveProperty("avatar");
    expect(normalizeOverride("k1", { avatar: "https://x.com/a.png" })).not.toHaveProperty("avatar");
  });

  it("avatar acima do teto do servidor é descartado (não derruba o arquivo)", () => {
    const big = `data:image/png;base64,${"A".repeat(400_001)}`;
    expect(normalizeOverride("k1", { avatar: big })).not.toHaveProperty("avatar");
  });

  it("relevância: arredonda e prende em 0..100; ignora não-número", () => {
    expect(normalizeOverride("k1", { relevance: 72.6 })?.relevance).toBe(73);
    expect(normalizeOverride("k1", { relevance: 250 })?.relevance).toBe(100);
    expect(normalizeOverride("k1", { relevance: -5 })?.relevance).toBe(0);
    expect(normalizeOverride("k1", { relevance: "80" })).not.toHaveProperty("relevance");
  });

  it("corta textos nos tetos do DTO", () => {
    const o = normalizeOverride("k1", {
      name: "n".repeat(200),
      twitter: "t".repeat(60),
      notes: "x".repeat(5000),
      types: ["a".repeat(50)],
      squads: ["s".repeat(100)],
    });
    expect(o?.name).toHaveLength(120);
    expect(o?.twitter).toHaveLength(40);
    expect(o?.notes).toHaveLength(4000);
    expect(o?.types?.[0]).toHaveLength(40);
    expect(o?.squads?.[0]).toHaveLength(80);
  });

  it("listas: tira itens que não são texto, vazios e o excesso", () => {
    const o = normalizeOverride("k1", {
      types: ["alpha", 1, "", "  ", null, "caller"],
      squads: Array.from({ length: 60 }, (_, i) => `s${i}`),
    });
    expect(o?.types).toEqual(["alpha", "caller"]);
    expect(o?.squads).toHaveLength(40);
  });

  it("carteiras: exige endereço, completa nome e remove campos extras", () => {
    const o = normalizeOverride("k1", {
      walletsAdded: [
        { name: "main", address: " So1 ", chain: "sol" },
        { address: "So2" },
        { name: "sem endereço" },
        "So3",
      ],
    });
    expect(o?.walletsAdded).toEqual([
      { name: "main", address: "So1" },
      { name: "", address: "So2" },
    ]);
  });

  it("recusa kolId inválido ou override que não é objeto", () => {
    expect(normalizeOverride("", { name: "A" })).toBeNull();
    expect(normalizeOverride(42, { name: "A" })).toBeNull();
    expect(normalizeOverride("x".repeat(121), { name: "A" })).toBeNull();
    expect(normalizeOverride("k1", "A")).toBeNull();
  });

  it("deleted só entra se for booleano", () => {
    expect(normalizeOverride("k1", { deleted: true })?.deleted).toBe(true);
    expect(normalizeOverride("k1", { deleted: "yes" })).not.toHaveProperty("deleted");
  });
});

describe("chunkOverrides", () => {
  const make = (n: number, extra = ""): KolImportOverride[] =>
    Array.from({ length: n }, (_, i) => ({ kolId: `k${i}`, notes: extra }));

  it("um lote só quando cabe", () => {
    expect(chunkOverrides(make(10))).toHaveLength(1);
    expect(chunkOverrides([])).toEqual([]);
  });

  it("parte por bytes sem perder nem repetir itens", () => {
    const items = make(10, "x".repeat(100));
    const chunks = chunkOverrides(items, 400);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(items);
    for (const c of chunks) {
      expect(JSON.stringify(c).length).toBeLessThan(400 + 150);
    }
  });

  it("parte pelo teto de itens do servidor", () => {
    const chunks = chunkOverrides(make(12), Infinity, 5);
    expect(chunks.map((c) => c.length)).toEqual([5, 5, 2]);
  });

  it("um item maior que o teto vai sozinho (o servidor decide)", () => {
    const chunks = chunkOverrides(
      [{ kolId: "a" }, { kolId: "big", notes: "x".repeat(1000) }, { kolId: "b" }],
      100,
    );
    expect(chunks.map((c) => c.map((o) => o.kolId))).toEqual([["a"], ["big"], ["b"]]);
  });
});

describe("backupFilename", () => {
  it("leva a data do export", () => {
    expect(backupFilename(new Date("2026-09-28T15:00:00Z"))).toBe("kol-index-backup-2026-09-28.json");
  });
});
