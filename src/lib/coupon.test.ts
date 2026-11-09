import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError } from "axios";

import {
  captureCouponFromUrl,
  clearCoupon,
  couponErrorMessage,
  isDeadCouponError,
  normalizeCoupon,
  storedCoupon,
  subscribeCoupon,
} from "@/lib/coupon";

function httpError(status: number, message?: string): AxiosError {
  return new AxiosError("fail", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: message ? { message } : {},
  } as never);
}

describe("coupon", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("guarda o código que veio no link, normalizado", () => {
    captureCouponFromUrl("?coupon=%20launch30%20");
    expect(storedCoupon()).toBe("LAUNCH30");
  });

  it("lê o cupom de dentro do `next` do login (proxy de rota protegida)", () => {
    // Como o proxy monta: /login?next=/plans%3Fcoupon%3DLAUNCH30
    captureCouponFromUrl("?next=%2Fplans%3Fcoupon%3Dlaunch30");
    expect(storedCoupon()).toBe("LAUNCH30");
  });

  it("o parâmetro direto tem precedência sobre o do `next`", () => {
    captureCouponFromUrl("?coupon=DIRECT&next=%2Fplans%3Fcoupon%3DNEXT");
    expect(storedCoupon()).toBe("DIRECT");
  });

  it("sobrevive a navegar para outra rota sem o parâmetro", () => {
    captureCouponFromUrl("?coupon=LAUNCH30");
    captureCouponFromUrl("");
    captureCouponFromUrl("?next=%2Fplans");
    expect(storedCoupon()).toBe("LAUNCH30");
  });

  it("o ÚLTIMO link vence (diferente da indicação)", () => {
    captureCouponFromUrl("?coupon=FIRST");
    captureCouponFromUrl("?coupon=SECOND");
    expect(storedCoupon()).toBe("SECOND");
  });

  it("descarta o que não pode ser um código, em vez de 'consertar'", () => {
    expect(normalizeCoupon("launch-30")).toBe("LAUNCH-30");
    expect(normalizeCoupon("AB")).toBeUndefined(); // curto demais
    expect(normalizeCoupon("A".repeat(33))).toBeUndefined(); // longo demais
    expect(normalizeCoupon("A".repeat(32))).toBe("A".repeat(32));
    expect(normalizeCoupon("LAUNCH 30")).toBeUndefined();
    expect(normalizeCoupon("<script>")).toBeUndefined();
    expect(normalizeCoupon("")).toBeUndefined();
    expect(normalizeCoupon(null)).toBeUndefined();

    captureCouponFromUrl("?coupon=bad%20code");
    expect(storedCoupon()).toBeUndefined();
    captureCouponFromUrl("?next=not%20a%20url%3Fcoupon%3D%25%25");
    expect(storedCoupon()).toBeUndefined();
  });

  it("clearCoupon apaga e avisa quem está inscrito", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCoupon(listener);
    captureCouponFromUrl("?coupon=LAUNCH30");
    expect(listener).toHaveBeenCalledTimes(1);
    clearCoupon();
    expect(storedCoupon()).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    captureCouponFromUrl("?coupon=OTHER");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("degrada para 'sem cupom' quando o storage está bloqueado", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    expect(() => captureCouponFromUrl("?coupon=LAUNCH30")).not.toThrow();
    expect(storedCoupon()).toBeUndefined();
    expect(() => clearCoupon()).not.toThrow();
  });

  it("erros definitivos (404/409/410) matam o código; 429 e rede não", () => {
    expect(isDeadCouponError(httpError(404))).toBe(true);
    expect(isDeadCouponError(httpError(409))).toBe(true);
    expect(isDeadCouponError(httpError(410))).toBe(true);
    expect(isDeadCouponError(httpError(429))).toBe(false);
    expect(isDeadCouponError(httpError(500))).toBe(false);
    expect(isDeadCouponError(new Error("x"))).toBe(false);
  });

  it("mensagem: a do servidor nos 4xx de regra (não o 'e-mail já cadastrado' do 409 genérico)", () => {
    expect(
      couponErrorMessage(httpError(409, "This account can't redeem a coupon."), "fb"),
    ).toBe("This account can't redeem a coupon.");
    expect(couponErrorMessage(httpError(410), "fb")).toBe("fb");
    expect(couponErrorMessage(httpError(429), "fb")).toBe(
      "Too many attempts. Wait a few minutes and try again.",
    );
  });
});
