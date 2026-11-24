import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import toast from "react-hot-toast";

import { CouponRedeem } from "./CouponRedeem";
import { BILLING_DETAILS_KEY, PLAN_KEY, type Plan } from "@/lib/api/billing";
import { useSession } from "@/lib/auth/useSession";
import { usePlan } from "@/lib/billing/usePlan";
import { captureCouponFromUrl, storedCoupon } from "@/lib/coupon";
import { API_URL } from "@/lib/env";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/auth/useSession");
vi.mock("@/lib/billing/usePlan");
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const REDEEM_URL = `${API_URL}/api/v1/billing/coupons/redeem`;
const PERIOD_END = "2026-12-09T12:00:00.000Z";
const PERIOD_END_LABEL = new Date(PERIOD_END).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const redeemed: string[] = [];
const server = setupServer(
  http.post(REDEEM_URL, async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    redeemed.push(code);
    if (code === "LAUNCH30") {
      return HttpResponse.json({ plan: "PRO", days: 30, currentPeriodEnd: PERIOD_END });
    }
    if (code === "USED") {
      return HttpResponse.json(
        { message: "This account is not eligible for a coupon." },
        { status: 409 },
      );
    }
    if (code === "BUSY") {
      return HttpResponse.json({ message: "Too many requests" }, { status: 429 });
    }
    return HttpResponse.json({ message: "Invalid coupon code." }, { status: 404 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function setup({ plan = "FREE", loading = false }: { plan?: Plan; loading?: boolean } = {}) {
  vi.mocked(useSession).mockReturnValue({
    profile: { role: "USER" },
    isAuthenticated: true,
    isLoading: false,
  } as never);
  vi.mocked(usePlan).mockReturnValue({
    plan,
    isPro: plan === "PRO",
    isLoading: loading,
    isError: false,
    access: undefined,
    isRestricted: false,
  });
}

describe("CouponRedeem (tela de planos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    redeemed.length = 0;
  });

  it("FREE sem cupom guardado: só o link 'Have a coupon?', que expande o campo", async () => {
    const user = userEvent.setup();
    setup();
    renderWithQuery(<CouponRedeem />);

    expect(screen.queryByLabelText("Coupon code")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Have a coupon?" }));
    expect(screen.getByLabelText("Coupon code")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Redeem" })).toBeDisabled();
  });

  it("cupom do link: aparece aberto e PREENCHIDO, sem resgatar sozinho", async () => {
    captureCouponFromUrl("?coupon=launch30");
    setup();
    renderWithQuery(<CouponRedeem />);

    expect(screen.getByLabelText("Coupon code")).toHaveValue("LAUNCH30");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(redeemed).toEqual([]);
  });

  it("cupom capturado depois de montar (Providers roda o efeito depois) também preenche", async () => {
    setup();
    renderWithQuery(<CouponRedeem />);
    expect(screen.queryByLabelText("Coupon code")).not.toBeInTheDocument();

    act(() => captureCouponFromUrl("?next=%2Fplans%3Fcoupon%3DLAUNCH30"));
    expect(await screen.findByLabelText("Coupon code")).toHaveValue("LAUNCH30");
  });

  it("sucesso: toast com a data, limpa o código e invalida plano e cobrança", async () => {
    const user = userEvent.setup();
    captureCouponFromUrl("?coupon=LAUNCH30");
    setup();
    const { client } = renderWithQuery(<CouponRedeem />);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await user.click(screen.getByRole("button", { name: "Redeem" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(`Pro unlocked until ${PERIOD_END_LABEL}.`),
    );
    expect(redeemed).toEqual(["LAUNCH30"]);
    expect(storedCoupon()).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PLAN_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: BILLING_DETAILS_KEY });
  });

  it("409: mostra a mensagem do servidor embaixo do campo e descarta o código guardado", async () => {
    const user = userEvent.setup();
    captureCouponFromUrl("?coupon=USED");
    setup();
    renderWithQuery(<CouponRedeem />);

    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account is not eligible for a coupon.",
    );
    expect(storedCoupon()).toBeUndefined();
    // O campo continua na tela com o que foi enviado, para o usuário corrigir.
    expect(screen.getByLabelText("Coupon code")).toHaveValue("USED");
    expect(toast.success).not.toHaveBeenCalled();

    // Digitar de novo some com o erro.
    await user.type(screen.getByLabelText("Coupon code"), "x");
    expect(screen.getByLabelText("Coupon code")).toHaveValue("USEDX");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("429: mostra o erro mas MANTÉM o código (é transitório)", async () => {
    const user = userEvent.setup();
    captureCouponFromUrl("?coupon=BUSY");
    setup();
    renderWithQuery(<CouponRedeem />);

    await user.click(screen.getByRole("button", { name: "Redeem" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Too many attempts/);
    expect(storedCoupon()).toBe("BUSY");
  });

  it("digitado à mão vai em maiúsculas; 404 mostra 'Invalid coupon code.'", async () => {
    const user = userEvent.setup();
    setup();
    renderWithQuery(<CouponRedeem />);

    await user.click(screen.getByRole("button", { name: "Have a coupon?" }));
    await user.type(screen.getByLabelText("Coupon code"), "nope");
    await user.click(screen.getByRole("button", { name: "Redeem" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid coupon code.");
    expect(redeemed).toEqual(["NOPE"]);
  });

  it("some para quem já é PRO e enquanto o plano carrega", () => {
    captureCouponFromUrl("?coupon=LAUNCH30");
    setup({ plan: "PRO" });
    const { unmount } = renderWithQuery(<CouponRedeem />);
    expect(screen.queryByLabelText("Coupon code")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Have a coupon?" })).not.toBeInTheDocument();
    unmount();

    setup({ loading: true });
    renderWithQuery(<CouponRedeem />);
    expect(screen.queryByLabelText("Coupon code")).not.toBeInTheDocument();
  });
});
