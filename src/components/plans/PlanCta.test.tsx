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
const getBilling = vi.mocked(api.getBillingDetails);
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
  billing = null,
}: {
  plan?: api.Plan;
  authenticated?: boolean;
  options?: api.CryptoOptions;
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
  getBilling.mockResolvedValue(billing);
}

/**
 * Espera as duas consultas RESOLVEREM (não só serem chamadas) antes de afirmar
 * que algo NÃO aparece — senão o teste passa no instante em que as opções ainda
 * não chegaram e a oferta de cripto está oculta por falta de dado, não por regra.
 */
async function settled() {
  await waitFor(() => expect(getOptions).toHaveBeenCalled());
  await waitFor(() => expect(getBilling).toHaveBeenCalled());
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

describe("PlanCta (card PRO) — oferta de cripto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("FREE com redes ligadas: oferece USDC e o botão abre o modal", async () => {
    const user = userEvent.setup();
    setup();
    renderWithQuery(<PlanCta tone="pro" />);

    expect(screen.getByRole("button", { name: "Choose this plan" })).toBeInTheDocument();
    const cryptoBtn = await screen.findByRole("button", {
      name: "Pay with USDC (prepaid)",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(cryptoBtn);

    expect(screen.getByRole("dialog", { name: "Pay with USDC" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /USDC on Solana/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /USDC on Base/ })).toBeInTheDocument();
  });

  it("fechar o modal pelo Close some com ele", async () => {
    const user = userEvent.setup();
    setup();
    renderWithQuery(<PlanCta tone="pro" />);

    await user.click(await screen.findByRole("button", { name: "Pay with USDC (prepaid)" }));
    const closes = screen.getAllByRole("button", { name: "Close" });
    await user.click(closes[closes.length - 1]);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sem rede ligada no servidor: nenhuma oferta de cripto", async () => {
    setup({ options: { ...OPTIONS, chains: [] } });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    expect(screen.queryByRole("button", { name: /USDC/ })).not.toBeInTheDocument();
  });

  it("deslogado: não consulta opções nem cobrança e não oferece cripto", async () => {
    setup({ authenticated: false });
    renderWithQuery(<PlanCta tone="pro" />);

    expect(screen.getByRole("button", { name: "Choose this plan" })).toBeInTheDocument();
    // Dá tempo de qualquer query disparar antes de afirmar que não disparou.
    await new Promise((r) => setTimeout(r, 20));
    expect(getOptions).not.toHaveBeenCalled();
    expect(getBilling).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /USDC/ })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("button", { name: /USDC/ })).not.toBeInTheDocument();
    // Renovando: não há data de fim a anunciar.
    expect(screen.queryByText(/Pro until/)).not.toBeInTheDocument();
  });

  it("cartão renovando mas o plano ainda carrega como FREE: sem cripto (servidor recusaria)", async () => {
    setup({
      plan: "FREE",
      billing: {
        provider: "STRIPE",
        currentPeriodEnd: PERIOD_END,
        cancelAtPeriodEnd: false,
      },
    });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    expect(screen.queryByRole("button", { name: /USDC/ })).not.toBeInTheDocument();
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

    const renew = await screen.findByRole("button", { name: "Renew with USDC" });
    expect(screen.getByText(`Pro until ${PERIOD_END_LABEL}`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Current plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose this plan" })).not.toBeInTheDocument();

    await user.click(renew);
    expect(screen.getByRole("dialog", { name: "Pay with USDC" })).toBeInTheDocument();
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

    const extend = await screen.findByRole("button", { name: "Extend with USDC" });
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(screen.getByText(/Pro until/)).toHaveTextContent(`Pro until ${PERIOD_END_LABEL}`);

    await user.click(extend);
    expect(screen.getByRole("dialog", { name: "Pay with USDC" })).toBeInTheDocument();
  });

  it("PRO sem detalhe de cobrança (ex.: ADMIN): só 'Current plan'", async () => {
    setup({ plan: "PRO", billing: null });
    renderWithQuery(<PlanCta tone="pro" />);

    await settled();
    expect(screen.getByRole("button", { name: "Current plan" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /USDC/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Pro until/)).not.toBeInTheDocument();
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
    expect(getBilling).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /USDC/ })).not.toBeInTheDocument();
  });

  it("usuário PRO vê 'Free plan' no card FREE", () => {
    setup({ plan: "PRO" });
    renderWithQuery(<PlanCta tone="free" />);
    expect(screen.getByRole("button", { name: "Free plan" })).toBeDisabled();
  });
});
