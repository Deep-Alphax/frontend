import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";

import { draftToFilters, formatMoney, PaymentsAdmin } from "./PaymentsAdmin";
import * as payments from "@/lib/api/payments";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/api/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof payments>();
  return { ...actual, getPayments: vi.fn(), syncPayments: vi.fn() };
});
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const getPayments = vi.mocked(payments.getPayments);
const syncPayments = vi.mocked(payments.syncPayments);

const SUMMARY: payments.PaymentsSummary = {
  receivedCents: 15_000,
  refundedCents: 2_000,
  paidCount: 3,
  failedCount: 1,
  currency: "usd",
};

function card(over: Partial<payments.PaymentItem> = {}): payments.PaymentItem {
  return {
    id: "p1",
    paidAt: "2026-09-22T12:00:00.000Z",
    provider: "STRIPE",
    status: "PAID",
    amountCents: 5_000,
    refundedCents: 0,
    currency: "usd",
    user: { id: "u1", email: "ana@deepalpha.fun" },
    chain: null,
    txHash: null,
    payer: null,
    providerRef: "in_1ABCDEF",
    receiptUrl: "https://invoice.stripe.com/i/acct_1/test_123",
    ...over,
  };
}

function usdc(over: Partial<payments.PaymentItem> = {}): payments.PaymentItem {
  return card({
    id: "p2",
    provider: "CRYPTO",
    amountCents: 5_001,
    user: { id: "u2", email: "bob@deepalpha.fun" },
    chain: "BASE",
    txHash: "0xabcdef1234567890abcdef1234567890",
    payer: "0x2222222222222222222222222222222222222222",
    providerRef: "BASE:0xabcdef1234567890abcdef1234567890",
    receiptUrl: "https://basescan.org/tx/0xabcdef1234567890abcdef1234567890",
    ...over,
  });
}

function page(
  items: payments.PaymentItem[],
  nextCursor: string | null = null,
): payments.PaymentsPage {
  return { items, nextCursor, summary: SUMMARY };
}

describe("PaymentsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPayments.mockResolvedValue(page([card(), usdc()]));
  });

  it("resumo: recebido líquido (recebido − reembolsado), reembolsado, pagos e falhas", async () => {
    renderWithQuery(<PaymentsAdmin />);
    await screen.findByText("ana@deepalpha.fun");
    const tile = (label: string) => screen.getByText(label, { selector: "span.text-xs" }).parentElement!;
    expect(tile("Received")).toHaveTextContent("$130.00");
    expect(tile("Refunded")).toHaveTextContent("$20.00");
    expect(tile("Payments")).toHaveTextContent("3");
    expect(tile("Failed")).toHaveTextContent("1");
  });

  it("lista cartão e USDC com usuário, método, valor, status e referência", async () => {
    renderWithQuery(<PaymentsAdmin />);
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);

    expect(rows[0]).toHaveTextContent("ana@deepalpha.fun");
    expect(rows[0]).toHaveTextContent("Card");
    expect(rows[0]).toHaveTextContent("$50.00");
    expect(rows[0]).toHaveTextContent("Paid");

    expect(rows[1]).toHaveTextContent("bob@deepalpha.fun");
    expect(rows[1]).toHaveTextContent("USDC · Base");
    expect(rows[1]).toHaveTextContent("$50.01");
    expect(rows[1]).toHaveTextContent("tx 0xabcd…7890");
    expect(rows[1]).toHaveTextContent("from 0x2222…2222");
  });

  it("reembolso parcial aparece abaixo do valor", async () => {
    getPayments.mockResolvedValue(
      page([card({ status: "PARTIALLY_REFUNDED", refundedCents: 1_500 })]),
    );
    renderWithQuery(<PaymentsAdmin />);
    expect(await screen.findByText("−$15.00 refunded")).toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByText("Partially refunded"),
    ).toBeInTheDocument();
  });

  it("comprovante abre em nova aba, sem vazar a origem; URL não-https não vira link", async () => {
    getPayments.mockResolvedValue(
      page([card(), card({ id: "p9", providerRef: "in_EVIL", receiptUrl: "javascript:alert(1)" })]),
    );
    renderWithQuery(<PaymentsAdmin />);
    const links = await screen.findAllByRole("link", { name: /View/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://invoice.stripe.com/i/acct_1/test_123");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("in_EVIL")).toBeInTheDocument();
  });

  it("filtros só valem no Apply e viram parâmetros da consulta", async () => {
    const user = userEvent.setup();
    renderWithQuery(<PaymentsAdmin />);
    await screen.findByText("ana@deepalpha.fun");
    expect(getPayments).toHaveBeenLastCalledWith({}, null);

    await user.type(screen.getByLabelText("User (id or e-mail)"), "bob");
    expect(getPayments).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("combobox", { name: "Method" }));
    await user.click(await screen.findByRole("option", { name: "USDC" }));
    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Refunded" }));

    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(getPayments).toHaveBeenLastCalledWith(
        { provider: "CRYPTO", status: "REFUNDED", user: "bob" },
        null,
      ),
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(getPayments).toHaveBeenLastCalledWith({}, null));
  });

  it("período: dia inteiro no fuso local", () => {
    const f = draftToFilters({
      provider: "__all",
      status: "__all",
      user: "",
      from: "2026-09-01",
      to: "2026-09-22",
    });
    expect(f.from).toBe(new Date("2026-09-01T00:00:00").toISOString());
    expect(f.to).toBe(new Date("2026-09-22T23:59:59.999").toISOString());
    expect(f.provider).toBeUndefined();
  });

  it("Load more busca pelo cursor e acumula", async () => {
    const user = userEvent.setup();
    getPayments
      .mockResolvedValueOnce(page([card({ id: "a", user: { id: "u1", email: "first@x.com" } })], "c1"))
      .mockResolvedValueOnce(page([card({ id: "b", user: { id: "u2", email: "second@x.com" } })]));
    renderWithQuery(<PaymentsAdmin />);

    await screen.findByText("first@x.com");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("second@x.com")).toBeInTheDocument();
    expect(screen.getByText("first@x.com")).toBeInTheDocument();
    expect(getPayments).toHaveBeenLastCalledWith({}, "c1");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("vazio", async () => {
    getPayments.mockResolvedValue(page([]));
    renderWithQuery(<PaymentsAdmin />);
    expect(await screen.findByText("No payments for these filters.")).toBeInTheDocument();
  });

  it("403 (sem papel de admin): erro NA HORA, sem nova tentativa e nunca 'vazio'", async () => {
    const { AxiosError } = await import("axios");
    getPayments.mockRejectedValue(
      new AxiosError("Forbidden", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 403,
        data: { message: "Admin access required" },
      } as never),
    );
    renderWithQuery(<PaymentsAdmin />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
    expect(screen.queryByText("No payments for these filters.")).not.toBeInTheDocument();
    expect(getPayments).toHaveBeenCalledTimes(1);
  });

  it("Sync: chama a API, avisa o que importou (e os erros) e recarrega a lista", async () => {
    const user = userEvent.setup();
    let resolve!: (r: payments.PaymentsSyncResult) => void;
    syncPayments.mockReturnValue(new Promise((r) => (resolve = r)));
    const { client } = renderWithQuery(<PaymentsAdmin />);
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await screen.findByText("ana@deepalpha.fun");

    await user.click(screen.getByRole("button", { name: /Sync from Stripe & chain/ }));
    expect(await screen.findByRole("button", { name: /Syncing…/ })).toBeDisabled();

    resolve({ stripe: { imported: 2 }, crypto: { imported: 1 }, errors: ["in_X: not found"] });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Imported 2 card and 1 USDC payments."),
    );
    expect(toast.error).toHaveBeenCalledWith("Some items failed: in_X: not found");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: payments.PAYMENTS_KEY });
    expect(syncPayments).toHaveBeenCalledTimes(1);
  });

  it("Sync com erro: toast de erro, lista intacta", async () => {
    const user = userEvent.setup();
    syncPayments.mockRejectedValue(new Error("boom"));
    renderWithQuery(<PaymentsAdmin />);
    await screen.findByText("ana@deepalpha.fun");
    await user.click(screen.getByRole("button", { name: /Sync from Stripe & chain/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not sync payments."));
    expect(screen.getByText("ana@deepalpha.fun")).toBeInTheDocument();
  });
});

describe("formatMoney", () => {
  it("formata pela moeda e não quebra com código desconhecido", () => {
    expect(formatMoney(5_000, "usd")).toBe("$50.00");
    expect(formatMoney(27_900, "brl")).toBe("R$279.00");
    expect(formatMoney(100, "zzzz")).toBe("1.00 ZZZZ");
  });
});
