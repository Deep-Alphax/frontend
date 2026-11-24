import { describe, expect, it } from "vitest";

import { inviteLink, inviteStatus, parseEmailList } from "@/lib/access/admin";
import type { AccessInvite } from "@/lib/api/access";

function invite(over: Partial<AccessInvite> = {}): AccessInvite {
  return {
    id: "i1",
    code: "ELIXIR1",
    role: "ELIXIR_ALPHA",
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    active: true,
    note: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    ...over,
  };
}

describe("parseEmailList", () => {
  it("quebra em vírgula, espaço e linha; normaliza e deduplica", () => {
    const parsed = parseEmailList(
      " Ana@Example.com, bruno@example.com\ncarla@example.com;ana@example.com\t\tBRUNO@example.com ",
    );
    expect(parsed.emails).toEqual(["ana@example.com", "bruno@example.com", "carla@example.com"]);
    expect(parsed.invalid).toEqual([]);
  });

  it("separa o que não parece e-mail", () => {
    const parsed = parseEmailList("ok@example.com, nope, @x.com, a@b");
    expect(parsed.emails).toEqual(["ok@example.com"]);
    expect(parsed.invalid).toEqual(["nope", "@x.com", "a@b"]);
  });

  it("texto vazio = lista vazia", () => {
    expect(parseEmailList("  \n , ")).toEqual({ emails: [], invalid: [] });
  });
});

describe("inviteLink", () => {
  it("aponta para /mentorship com o código, sem barra dupla", () => {
    expect(inviteLink("https://deepalpha.fun/", "ELIXIR-1")).toBe(
      "https://deepalpha.fun/mentorship?invite=ELIXIR-1",
    );
  });
});

describe("inviteStatus", () => {
  const now = Date.parse("2026-11-24T12:00:00.000Z");

  it("desativado > vencido > esgotado > ativo", () => {
    expect(inviteStatus(invite({ active: false, maxUses: 1, usedCount: 1 }), now)).toBe("DISABLED");
    expect(inviteStatus(invite({ expiresAt: "2026-11-01T00:00:00.000Z" }), now)).toBe("EXPIRED");
    expect(inviteStatus(invite({ maxUses: 5, usedCount: 5 }), now)).toBe("EXHAUSTED");
    expect(inviteStatus(invite({ maxUses: null, usedCount: 9999 }), now)).toBe("ACTIVE");
  });
});
