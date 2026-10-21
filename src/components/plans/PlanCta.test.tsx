import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { PlanCta } from "./PlanCta";
import * as api from "@/lib/api/billing";
import { useSession } from "@/lib/auth/useSession";
import { usePlan } from "@/lib/billing/usePlan";

vi.mock("@/lib/api/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getCryptoOptions: vi.fn(),
    getPixOptions: vi.fn(),
    getBillingDetails: vi.fn(),
    createCheckout: vi.fn(),
    createCryptoPayment: vi.fn(),
    getCryptoPayment: vi.fn(),
  };
});
vi.mock("@/lib/auth/useSession");
vi.mock("@/lib/billing/usePlan");
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const getOptions = vi.mocked(api.getCryptoOptions);
const getPix = vi.mocked(api.getPixOptions);
const getBilling = vi.mocked(api.getBillingDetails);

const PIX_ON: api.PixOptions = {
  enabled: true,
  periodDays: 30,
  amountUsdCents: 5000,
  quoteBrlCents: 25308,
};
const PIX_OFF: api.PixOptions = { enabled: false, periodDays: 30 };
const mockSession = vi.mocked(useSession);
const mockPlan = vi.mocked(usePlan);

const OPTIONS: api.CryptoOptions = {
  token: "USDC",
  amount: "50",
  periodDays: 30,
  chains: ["SOLANA", "BASE"],
};

const PERIOD_END = "2026-10-22T12:00:00.000Z";
const PERIOD_END_LABEL = new Date(PERIOD_END).toLocaleDateString("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function setup({
  plan = "FREE",
  authenticated = true,
  options = OPTIONS,
  pix = PIX_OFF,
  billing = null,
}: {
  plan?: api.Plan;
  authenticated?: boolean;
  options?: api.CryptoOptions;
  pix?: api.PixOptions;
  billing?: api.BillingDetails | null;
} = {}) {
  mockSession.mockReturnValue({
    profile: authenticated ? ({ role: "USER" } as never) : null,
    isAuthenticated: authenticated,
    isLoading: false,
  } as never);
  mockPlan.mockReturnValue({
    plan,
    isPro: plan === "PRO",
    isLoading: false,
  });
  getOptions.mockResolvedValue(options);
  getPix.mockResolvedValue(pix);
  getBilling.mockResolvedValue(billing);
}

/**
 * Espera as duas consultas RESOLVEREM (não só serem chamadas) antes de afirmar
 * que algo NÃO aparece — senão o teste passa no instante em que as opções ainda
 * não chegaram e a oferta de cripto está oculta por falta de dado, não por regra.
 */
async function settled() {
  await waitFor(() => expect(getOptions).toHaveBeenCalled());
  await waitFor(() => expect(getPix).toHaveBeenCalled());
  await waitFor(() => expect(getBilling).toHaveBeenCalled());
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

describe("PlanCta (card PRO) — oferta de cripto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("o card tem UM botão; ele abre a escolha do meio, e USDC abre o modal de cripto", async () => {
    const user = userEvent.setup();
    setup();
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    // No card: só o "Choose this plan" (os meios ficam no modal).
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Choose this plan" }));

    const chooser = screen.getByRole("dialog", { name: "Choose how to pay" });
    expect(chooser).toHaveTextContent(/Card.*renews automatically/);
    await user.click(screen.getByRole("button", { name: /^USDC/ }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Choose how to pay" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("dialog", { name: "Pay with USDC" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Network" }));
    const options = Array.from(
      (await screen.findByRole("listbox")).querySelectorAll('[role="option"]'),
    ).map((o) => o.textContent);
    expect(options).toEqual(["USDC on Solana", "USDC on Base"]);
  });

  it("cartão no modal abre o Checkout do Stripe", async () => {
    const user = userEvent.setup();
    setup();
    const checkout = vi
      .mocked(api.createCheckout)
      .mockReturnValue(new Promise(() => undefined));
    renderWithQuery(<PlanCta tone="pro" />);

    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    await user.click(screen.getByRole("button", { name: /^Card/ }));

    expect(checkout).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: /^Opening checkout…/ }),
    ).toBeDisabled();
  });

  it("o botão ocupa a largura toda do card", async () => {
    // O container do CTA no PlanCard é `items-start`: sem `w-full` no wrapper
    // ele encolhe até o conteúdo e o botão fica pela metade.
    setup();
    renderWithQuery(<PlanCta tone="pro" />);
    const cardBtn = screen.getByRole("button", { name: "Choose this plan" });
    expect(cardBtn.parentElement!.className).toMatch(/\bw-full\b/);
    expect(cardBtn.className).toMatch(/\bw-full\b/);
  });

  it("Cancel fecha a escolha", async () => {
    const user = userEvent.setup();
    setup();
    renderWithQuery(<PlanCta tone="pro" />);

    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("sem rede ligada no servidor: o modal não oferece USDC", async () => {
    const user = userEvent.setup();
    setup({ options: { ...OPTIONS, chains: [] } });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    expect(screen.getByRole("button", { name: /^Card/ })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^USDC/ }),
    ).not.toBeInTheDocument();
  });

  it("deslogado: não consulta opções e o botão leva ao login", async () => {
    setup({ authenticated: false });
    renderWithQuery(<PlanCta tone="pro" />);

    expect(
      screen.getByRole("button", { name: "Choose this plan" }),
    ).toBeInTheDocument();
    // Dá tempo de qualquer query disparar antes de afirmar que não disparou.
    await new Promise((r) => setTimeout(r, 20));
    expect(getOptions).not.toHaveBeenCalled();
    expect(getBilling).not.toHaveBeenCalled();
  });

  it("cartão renovando (PRO via Stripe): sem opção de cripto", async () => {
    setup({
      plan: "PRO",
      billing: {
        provider: "STRIPE",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /USDC/ }),
    ).not.toBeInTheDocument();
    // Renovando: não há data de fim a anunciar.
    expect(screen.queryByText(/Pro until/)).not.toBeInTheDocument();
  });

  it("cartão renovando mas o plano ainda carrega como FREE: sem cripto (servidor recusaria)", async () => {
    const user = userEvent.setup();
    setup({
      plan: "FREE",
      pix: PIX_ON,
      billing: {
        provider: "STRIPE",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    expect(
      screen.queryByRole("button", { name: /^USDC/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Pix/ }),
    ).not.toBeInTheDocument();
  });

  it("PRO via CRYPTO: 'Renew with USDC' + data de fim, e o botão abre o modal", async () => {
    const user = userEvent.setup();
    setup({
      plan: "PRO",
      billing: {
        provider: "CRYPTO",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: true,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    const renew = await screen.findByRole("button", {
      name: "Renew with USDC",
    });
    expect(
      screen.getByText(`Pro until ${PERIOD_END_LABEL}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Current plan" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Choose this plan" }),
    ).not.toBeInTheDocument();

    await user.click(renew);
    expect(
      screen.getByRole("dialog", { name: "Pay with USDC" }),
    ).toBeInTheDocument();
  });

  it("PRO via Stripe cancelado: 'Current plan' + 'Extend with USDC' que abre o modal", async () => {
    const user = userEvent.setup();
    setup({
      plan: "PRO",
      billing: {
        provider: "STRIPE",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: true,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    const extend = await screen.findByRole("button", {
      name: "Extend with USDC",
    });
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(screen.getByText(/Pro until/)).toHaveTextContent(
      `Pro until ${PERIOD_END_LABEL}`,
    );

    await user.click(extend);
    expect(
      screen.getByRole("dialog", { name: "Pay with USDC" }),
    ).toBeInTheDocument();
  });

  it("PRO sem detalhe de cobrança (ex.: ADMIN): só 'Current plan'", async () => {
    setup({ plan: "PRO", billing: null });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /USDC/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Pro until/)).not.toBeInTheDocument();
  });
});

describe("PlanCta (card PRO) — oferta de Pix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Pix no modal mostra o valor em reais e abre o modal do Pix", async () => {
    const user = userEvent.setup();
    setup({ pix: PIX_ON });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    const pixRow = screen.getByRole("button", { name: /^Pix/ });
    expect(pixRow).toHaveTextContent("R$ 253,08 · 30 days · doesn't renew");
    await user.click(pixRow);

    const dialog = screen.getByRole("dialog", { name: "Pay with Pix" });
    expect(dialog).toHaveTextContent("R$ 253,08 · 30 days of Pro");
    expect(
      screen.getByRole("button", { name: "Generate Pix · R$ 253,08" }),
    ).toBeInTheDocument();
  });

  it("enquanto as opções carregam, a linha do Pix é skeleton", async () => {
    const user = userEvent.setup();
    setup({ pix: PIX_ON });
    let releasePix!: (v: api.PixOptions) => void;
    getPix.mockReturnValue(new Promise((r) => (releasePix = r)));
    renderWithQuery(<PlanCta tone="pro" />);

    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    // USDC já respondeu; o Pix ainda espera a cotação.
    expect(
      await screen.findByRole("button", { name: /^USDC/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading Pix");

    await act(async () => releasePix(PIX_ON));
    expect(
      await screen.findByRole("button", { name: /^Pix/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("Pix desligado no servidor: o modal não oferece Pix", async () => {
    const user = userEvent.setup();
    setup();
    renderWithQuery(<PlanCta tone="pro" />);
    await settled();
    await user.click(screen.getByRole("button", { name: "Choose this plan" }));
    expect(
      screen.queryByRole("button", { name: /^Pix/ }),
    ).not.toBeInTheDocument();
  });

  it("cartão renovando: sem Pix (servidor recusaria)", async () => {
    setup({
      plan: "PRO",
      pix: PIX_ON,
      billing: {
        provider: "STRIPE",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);
    await settled();
    expect(
      screen.queryByRole("button", { name: /Pix/ }),
    ).not.toBeInTheDocument();
  });

  it("PRO via PIX: 'Renew with Pix' em destaque e USDC como alternativa", async () => {
    setup({
      plan: "PRO",
      pix: PIX_ON,
      billing: {
        provider: "PIX",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: true,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    const pix = await screen.findByRole("button", { name: "Renew with Pix" });
    const usdc = screen.getByRole("button", { name: "Renew with USDC" });
    // O meio usado vem primeiro.
    expect(
      pix.compareDocumentPosition(usdc) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByText(`Pro until ${PERIOD_END_LABEL}`),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Current plan" }),
    ).not.toBeInTheDocument();
  });

  it("PRO via CRYPTO com Pix ligado: USDC primeiro, Pix depois", async () => {
    setup({
      plan: "PRO",
      pix: PIX_ON,
      billing: {
        provider: "CRYPTO",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: true,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    const pix = await screen.findByRole("button", { name: "Renew with Pix" });
    const usdc = screen.getByRole("button", { name: "Renew with USDC" });
    expect(
      usdc.compareDocumentPosition(pix) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("PRO via Stripe cancelado: 'Extend with Pix' abre o modal", async () => {
    const user = userEvent.setup();
    setup({
      plan: "PRO",
      pix: PIX_ON,
      billing: {
        provider: "STRIPE",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: true,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    await user.click(
      await screen.findByRole("button", { name: "Extend with Pix" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Pay with Pix" }),
    ).toBeInTheDocument();
  });
});

describe("PlanCta (card FREE)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não consulta opções de cripto nem cobrança", async () => {
    setup();
    renderWithQuery(<PlanCta tone="free" />);

    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    await new Promise((r) => setTimeout(r, 20));
    expect(getOptions).not.toHaveBeenCalled();
    expect(getPix).not.toHaveBeenCalled();
    expect(getBilling).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /USDC/ }),
    ).not.toBeInTheDocument();
  });

  it("usuário PRO vê 'Free plan' no card FREE", () => {
    setup({ plan: "PRO" });
    renderWithQuery(<PlanCta tone="free" />);
    expect(screen.getByRole("button", { name: "Free plan" })).toBeDisabled();
  });
});
