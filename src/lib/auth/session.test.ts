import { describe, it, expect, beforeEach } from "vitest";
import { hasSessionHint, SESSION_HINT_COOKIE } from "./sessionHint";
import { safeRedirect } from "./redirect";

/** Zera os cookies do jsdom entre os testes (isolamento). */
function clearCookies() {
  for (const entry of document.cookie.split("; ")) {
    const name = entry.split("=")[0];
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

describe("hasSessionHint", () => {
  beforeEach(clearCookies);

  it("false quando não há cookie-dica (deslogado → não chama a API)", () => {
    expect(hasSessionHint()).toBe(false);
  });

  it("true quando pt_authed_client=1", () => {
    document.cookie = `${SESSION_HINT_COOKIE}=1`;
    expect(hasSessionHint()).toBe(true);
  });

  it("false quando o valor não é exatamente 1", () => {
    document.cookie = `${SESSION_HINT_COOKIE}=0`;
    expect(hasSessionHint()).toBe(false);
  });

  it("não casa cookie de outro nome que contém o texto", () => {
    document.cookie = `not_${SESSION_HINT_COOKIE}=1`;
    expect(hasSessionHint()).toBe(false);
  });

  it("detecta o cookie-dica entre vários cookies", () => {
    document.cookie = "a=b";
    document.cookie = `${SESSION_HINT_COOKIE}=1`;
    document.cookie = "c=d";
    expect(hasSessionHint()).toBe(true);
  });
});

describe("safeRedirect (anti open-redirect)", () => {
  it.each([
    [null, "/"],
    ["", "/"],
    ["/", "/"],
    ["/dashboard", "/dashboard"],
    ["/a/b?x=1&y=2", "/a/b?x=1&y=2"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["http://evil.com", "/"],
    ["javascript:alert(1)", "/"],
    ["mailto:x@y.z", "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirect(input as string | null)).toBe(expected);
  });
});
