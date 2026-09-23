import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";

import { renderWithQuery } from "@/test/queryWrapper";
import { CryptoPayModal } from "./CryptoPayModal";
import * as api from "@/lib/api/billing";
import type { WalletPayProps } from "@/components/plans/crypto/walletUi";
import toast from "react-hot-toast";

vi.mock("@/lib/api/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    createCryptoPayment: vi.fn(),
    getCryptoPayment: vi.fn(),
    submitCryptoPayment: vi.fn(),
  };
});
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

/*
 * A camada de carteira (wagmi / wallet-adapter) é substituída na fronteira do
 * módulo: o modal só conhece o contrato `WalletPayProps`. O que cada carteira
 * faz de fato é testado em `EvmWalletPay.test.tsx` / `SolanaWalletPay.test.tsx`.
 */
const EVM_SENT = { txHash: "0xhash", payer: "0xPayer", signature: "0xsig" };
const SOL_SENT = { txHash: "SolSig111", payer: "SolPayer111" };

function fakeWallet(family: "evm" | "solana") {
  return function FakeWalletPay(props: WalletPayProps) {
    return (
      <div data-testid={`wallet-${family}`}>
        <span>
          {props.payment.amount} USDC on {props.network}
        </span>
        <button
          type="button"
          disabled={props.busy}
          onClick={() => props.onSent(family === "evm" ? EVM_SENT : SOL_SENT)}
        >
          Fake pay
        </button>
        {props.error && <p role="alert">{props.error}</p>}
      </div>
    );
  };
}
vi.mock("@/components/plans/crypto/EvmWalletPay", () => ({ default: fakeWallet("evm") }));
vi.mock("@/components/plans/crypto/SolanaWalletPay", () => ({
  default: fakeWallet("solana"),
}));

const createPay = vi.mocked(api.createCryptoPayment);
const submitPay = vi.mocked(api.submitCryptoPayment);

const ALL: api.CryptoChain[] = [
  "SOLANA",
  "ETHEREUM",
  "BASE",
  "ARBITRUM",
  "OPTIMISM",
  "POLYGON",
  "BSC",
];

function inOneHour() {
  return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

function payment(over: Partial<api.CryptoPayment> = {}): api.CryptoPayment {
  return {
    id: "pay1",
    chain: "BASE",
    status: "PENDING",
    token: "USDC",
    tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    tokenDecimals: 6,
    chainId: 8453,
    amount: "50",
    receiver: "0x184f309b7D9f4c2430506831778173ecDAC55B84",
    reference: null,
    periodDays: 30,
    expiresAt: inOneHour(),
    confirmedAt: null,
    txHash: null,
    submittedTxHash: null,
    declaredPayer: null,
    ownershipMessage: "DeepAlpha payment pay1",
    ...over,
  };
}

const SOLANA_PAYMENT = payment({
  id: "sol1",
  chain: "SOLANA",
  tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  chainId: null,
  receiver: "BLNe5umxS7QGZPxvYAq3Favrs4hdeS47nThytnfFoE4u",
  reference: "Ref1111111111111111111111111111111111111111",
  ownershipMessage: null,
});

function axiosError(status: number, message: string) {
  return new AxiosError(message, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { message },
  });
}

function renderModal(props: Partial<Parameters<typeof CryptoPayModal>[0]> = {}) {
  const onClose = vi.fn();
  const utils = renderWithQuery(
    <CryptoPayModal
      open
      chains={ALL}
      amount="50"
      periodDays={30}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...utils, onClose };
}

type User = ReturnType<typeof userEvent.setup>;

async function selectChain(user: User, label: RegExp) {
  await user.click(screen.getByRole("combobox", { name: "Network" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

async function pickChain(user: User, label: RegExp) {
  await selectChain(user, label);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe("CryptoPayModal — rede", () => {
  it("cabeçalho enxuto: valor, período e que não renova", () => {
    renderModal();
    expect(screen.getByText("50 USDC · 30 days of Pro · doesn't renew")).toBeInTheDocument();
  });

  it("lista só as redes recebidas, com a nota curta dentro do item", async () => {
    const user = userEvent.setup();
    renderModal({ chains: ["SOLANA", "ETHEREUM", "BSC"] });

    await user.click(screen.getByRole("combobox", { name: "Network" }));
    const list = await screen.findByRole("listbox");
    expect(
      Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent),
    ).toEqual(["USDC on Solana", "USDC on Ethereum · higher fee", "USDC on BNB Chain · Binance-Peg"]);
  });

  it("Continue só habilita com rede escolhida; escolher não cria cobrança", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await selectChain(user, /USDC on Base/);
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(createPay).not.toHaveBeenCalled();
  });

  it("Esc com o dropdown aberto fecha só o dropdown, não o modal", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole("combobox", { name: "Network" }));
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();

    await new Promise((r) => setTimeout(r, 0));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fechado não renderiza nada", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("erro ao criar → toast e continua no seletor", async () => {
    const user = userEvent.setup();
    createPay.mockRejectedValue(new Error("boom"));
    renderModal();

    await pickChain(user, /USDC on Base/);

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});

describe("CryptoPayModal — carteira", () => {
  it("EVM: abre a carteira EVM com a cobrança; Back volta à rede", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment());
    renderModal();

    await pickChain(user, /USDC on Base/);

    expect(createPay.mock.calls[0][0]).toBe("BASE");
    const wallet = await screen.findByTestId("wallet-evm");
    expect(wallet).toHaveTextContent("50 USDC on Base");
    expect(screen.queryByTestId("wallet-solana")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("combobox", { name: "Network" })).toBeInTheDocument();
  });

  it("Solana: abre a carteira Solana", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(SOLANA_PAYMENT);
    renderModal();

    await pickChain(user, /USDC on Solana/);

    expect(await screen.findByTestId("wallet-solana")).toHaveTextContent("50 USDC on Solana");
  });

  it("envio → registra {txHash, payer, signature}; sem Back enquanto registra; depois confirmando", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment());
    let resolve!: (p: api.CryptoPayment) => void;
    submitPay.mockReturnValue(new Promise((r) => (resolve = r)));
    renderModal();

    await pickChain(user, /USDC on Base/);
    await user.click(await screen.findByRole("button", { name: "Fake pay" }));

    expect(submitPay).toHaveBeenCalledWith("pay1", EVM_SENT);
    expect(screen.getByText("Payment sent — registering…")).toBeInTheDocument();
    expect(screen.queryByTestId("wallet-evm")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();

    await act(async () => resolve(payment({ submittedTxHash: "0xhash" })));

    expect(await screen.findByText("Confirming on Base…")).toBeInTheDocument();
    expect(
      screen.getByText("You can close this window — we'll credit it automatically."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    // Registrado: a retomada local é descartada.
    expect(localStorage.getItem("deepalpha:crypto-sent:pay1")).toBeNull();
  });

  it("cobrança que já está confirmando (reaberta) não oferece pagar de novo", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment({ submittedTxHash: "0xold" }));
    renderModal();

    await pickChain(user, /USDC on Base/);

    expect(await screen.findByText("Confirming on Base…")).toBeInTheDocument();
    expect(screen.queryByTestId("wallet-evm")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("400 (transação não paga a cobrança) → volta à carteira com a mensagem", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment());
    submitPay.mockRejectedValue(axiosError(400, "This transaction does not pay this charge."));
    renderModal();

    await pickChain(user, /USDC on Base/);
    await user.click(await screen.findByRole("button", { name: "Fake pay" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This transaction does not pay this charge.",
    );
    expect(screen.getByTestId("wallet-evm")).toBeInTheDocument();
    expect(localStorage.getItem("deepalpha:crypto-sent:pay1")).toBeNull();
  });

  it("falha de rede ao registrar → Retry reenvia o MESMO hash; nunca oferece pagar de novo", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment());
    submitPay.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
    renderModal();

    await pickChain(user, /USDC on Base/);
    await user.click(await screen.findByRole("button", { name: "Fake pay" }));

    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Don't pay again/);
    expect(screen.queryByTestId("wallet-evm")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("deepalpha:crypto-sent:pay1")!)).toEqual(EVM_SENT);

    submitPay.mockResolvedValueOnce(payment({ submittedTxHash: "0xhash" }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(submitPay).toHaveBeenCalledTimes(2);
    expect(submitPay.mock.calls[1]).toEqual(["pay1", EVM_SENT]);
    expect(await screen.findByText("Confirming on Base…")).toBeInTheDocument();
  });

  it("retomada: hash guardado de uma visita anterior é reenviado sozinho", async () => {
    const user = userEvent.setup();
    localStorage.setItem("deepalpha:crypto-sent:pay1", JSON.stringify(EVM_SENT));
    createPay.mockResolvedValue(payment());
    submitPay.mockResolvedValue(payment({ submittedTxHash: "0xhash" }));
    renderModal();

    await pickChain(user, /USDC on Base/);

    await waitFor(() => expect(submitPay).toHaveBeenCalledWith("pay1", EVM_SENT));
    expect(submitPay).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Confirming on Base…")).toBeInTheDocument();
  });

  it("servidor descarta a transação em confirmação → carteira volta com aviso", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment({ submittedTxHash: "0xold" }));
    const { client } = renderModal();

    await pickChain(user, /USDC on Base/);
    await screen.findByText("Confirming on Base…");

    act(() => client.setQueryData(["crypto-payment", "pay1"], payment()));

    expect(await screen.findByTestId("wallet-evm")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't verify your last transaction.",
    );
  });

  it("janela vencida sem envio → não oferece pagar", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment({ expiresAt: new Date(Date.now() - 1000).toISOString() }));
    renderModal();

    await pickChain(user, /USDC on Base/);

    expect(
      await screen.findByText("This payment expired. Go back to start a new one."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("wallet-evm")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });

  it("confirmado → recebido, Done fecha, e o plano é recarregado", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment());
    submitPay.mockResolvedValue(
      payment({ status: "CONFIRMED", confirmedAt: "2026-09-23T12:00:00.000Z", txHash: "0xhash" }),
    );
    const { client, onClose } = renderModal();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await pickChain(user, /USDC on Base/);
    await user.click(await screen.findByRole("button", { name: "Fake pay" }));

    expect(await screen.findByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText("30 days of Pro added on Sep 23, 2026.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: api.PLAN_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: api.BILLING_DETAILS_KEY });

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalled();
  });

});
