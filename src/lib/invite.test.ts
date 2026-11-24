import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

import {
  captureInviteFromUrl,
  clearInvite,
  inviteErrorMessage,
  isDeadInviteError,
  normalizeInvite,
  storedInvite,
  subscribeInvite,
} from "@/lib/invite";

function httpError(status: number, message?: string): AxiosError {
  return new AxiosError("fail", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: message ? { message } : {},
  } as never);
}

describe("invite", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("guarda o código do link, normalizado (trim + maiúsculas)", () => {
    captureInviteFromUrl("?invite=%20elixir-vip%20");
    expect(storedInvite()).toBe("ELIXIR-VIP");
    expect(window.localStorage.getItem("da_invite")).toBe("ELIXIR-VIP");
  });

  it("lê o convite de dentro do `next` do login", () => {
    // Como o proxy monta: /login?next=/mentorship%3Finvite%3DELIXIR1
    captureInviteFromUrl("?next=%2Fmentorship%3Finvite%3Delixir1");
    expect(storedInvite()).toBe("ELIXIR1");
  });

  it("o parâmetro direto vence o do `next`, e o último link vence", () => {
    captureInviteFromUrl("?invite=DIRECT&next=%2Fmentorship%3Finvite%3DNEXT");
    expect(storedInvite()).toBe("DIRECT");
    captureInviteFromUrl("?invite=SECOND");
    expect(storedInvite()).toBe("SECOND");
  });

  it("sobrevive a navegar sem o parâmetro; não mistura com o cupom", () => {
    captureInviteFromUrl("?invite=ELIXIR1");
    captureInviteFromUrl("");
    captureInviteFromUrl("?coupon=LAUNCH30");
    expect(storedInvite()).toBe("ELIXIR1");
  });

  it("descarta o que não pode ser um código, em vez de 'consertar'", () => {
    expect(normalizeInvite("AB")).toBeUndefined();
    expect(normalizeInvite("A".repeat(33))).toBeUndefined();
    expect(normalizeInvite("elixir vip")).toBeUndefined();
    expect(normalizeInvite(null)).toBeUndefined();
    captureInviteFromUrl("?invite=%3Cscript%3E");
    expect(storedInvite()).toBeUndefined();
  });

  it("limpa e avisa quem está inscrito", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInvite(listener);
    captureInviteFromUrl("?invite=ELIXIR1");
    expect(listener).toHaveBeenCalledTimes(1);
    clearInvite();
    expect(storedInvite()).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("storage bloqueado degrada para 'sem convite' sem lançar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => captureInviteFromUrl("?invite=ELIXIR1")).not.toThrow();
    expect(storedInvite()).toBeUndefined();
    expect(() => clearInvite()).not.toThrow();
  });

  it("404/409/410 são definitivos; 429 e rede não", () => {
    expect(isDeadInviteError(httpError(404))).toBe(true);
    expect(isDeadInviteError(httpError(409))).toBe(true);
    expect(isDeadInviteError(httpError(410))).toBe(true);
    expect(isDeadInviteError(httpError(429))).toBe(false);
    expect(isDeadInviteError(httpError(500))).toBe(false);
    expect(isDeadInviteError(new Error("network"))).toBe(false);
  });

  it("mostra a mensagem do backend nos 4xx de regra (inclusive 409)", () => {
    expect(inviteErrorMessage(httpError(410, "This invite has expired."), "x")).toBe(
      "This invite has expired.",
    );
    expect(inviteErrorMessage(httpError(409, "Admins can't redeem invites."), "x")).toBe(
      "Admins can't redeem invites.",
    );
  });
});
