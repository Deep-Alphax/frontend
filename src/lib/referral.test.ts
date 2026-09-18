import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureReferralFromUrl,
  clearReferral,
  storedReferral,
} from "@/lib/referral";

describe("referral", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("guarda o código que veio no link", () => {
    captureReferralFromUrl("?ref=deep-alpha");
    expect(storedReferral()).toBe("deep-alpha");
  });

  it("sobrevive a navegar para outra rota sem o parâmetro", () => {
    captureReferralFromUrl("?ref=deep-alpha");
    captureReferralFromUrl(""); // usuário foi para /plans
    expect(storedReferral()).toBe("deep-alpha");
  });

  it("mantém o PRIMEIRO código — foi ele que trouxe a pessoa", () => {
    captureReferralFromUrl("?ref=primeiro");
    captureReferralFromUrl("?ref=segundo");
    expect(storedReferral()).toBe("primeiro");
  });

  it("ignora ref vazio e link sem ref", () => {
    captureReferralFromUrl("?ref=");
    expect(storedReferral()).toBeUndefined();
    captureReferralFromUrl("?utm_source=x");
    expect(storedReferral()).toBeUndefined();
  });

  it("corta código absurdamente longo antes de guardar", () => {
    captureReferralFromUrl(`?ref=${"a".repeat(500)}`);
    expect(storedReferral()).toHaveLength(24);
  });

  it("some depois do cadastro — a próxima conta não herda o padrinho", () => {
    captureReferralFromUrl("?ref=deep-alpha");
    clearReferral();
    expect(storedReferral()).toBeUndefined();
  });

  it("degrada para 'sem indicação' quando o storage está bloqueado", () => {
    // Aba privada / cookies de terceiros barrados: o acessor LANÇA. A captura
    // não pode derrubar a página inteira por causa disso.
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => captureReferralFromUrl("?ref=deep-alpha")).not.toThrow();
    expect(storedReferral()).toBeUndefined();
  });
});
