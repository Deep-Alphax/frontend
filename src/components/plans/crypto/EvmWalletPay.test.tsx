import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { decodeFunctionData, erc20Abi } from "viem";

import type { CryptoPayment } from "@/lib/api/billing";
import EvmWalletPay from "./EvmWalletPay";

/*
 * wagmi fica na fronteira: hooks devolvem o estado que o teste quer, e as
 * actions são espiãs. O que importa aqui é a ORDEM e o conteúdo das chamadas à
 * carteira — assinar antes de enviar, transferência certa no contrato certo.
 */
const state = vi.hoisted(() => ({
  connection: { status: "disconnected" } as Record<string, unknown>,
  connectors: [] as Array<Record<string, unknown>>,
}));
const actions = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  sendTransaction: vi.fn(),
  signMessage: vi.fn(),
  switchChain: vi.fn(),
}));

vi.mock("wagmi", () => ({
  createConfig: () => ({}),
  custom: () => ({}),
  WagmiProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useConfig: () => ({ cfg: true }),
  useConnection: () => state.connection,
  useConnectors: () => state.connectors,
}));
vi.mock("wagmi/actions", () => actions);
vi.mock("wagmi/connectors", () => ({ injected: () => ({}) }));

const PAYER = "0x1111111111111111111111111111111111111111";
const RECEIVER = "0x184f309b7D9f4c2430506831778173ecDAC55B84";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function payment(over: Partial<CryptoPayment> = {}): CryptoPayment {
  return {
    id: "pay1",
    chain: "BASE",
    status: "PENDING",
    token: "USDC",
    tokenAddress: USDC_BASE,
    tokenDecimals: 6,
    chainId: 8453,
    amount: "100",
    receiver: RECEIVER,
    reference: null,
    periodDays: 30,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    confirmedAt: null,
    txHash: null,
    submittedTxHash: null,
    declaredPayer: null,
    ownershipMessage: "DeepAlpha: I own this wallet (payment pay1)",
    ...over,
  };
}

function renderPay(p: CryptoPayment = payment(), error: string | null = null) {
  const onSent = vi.fn();
  render(<EvmWalletPay payment={p} network="Base" busy={false} error={error} onSent={onSent} />);
  return { onSent };
}

function connected(chainId = 8453) {
  state.connection = { status: "connected", address: PAYER, chainId, connector: { id: "io.metamask" } };
}

beforeEach(() => {
  vi.clearAllMocks();
  state.connection = { status: "disconnected" };
  state.connectors = [];
});

describe("EvmWalletPay — conectar", () => {
  it("lista as carteiras anunciadas (6963), sem a genérica", async () => {
    const user = userEvent.setup();
    const metamask = { uid: "u1", id: "io.metamask", name: "MetaMask", type: "injected", icon: "data:image/png;base64,x" };
    state.connectors = [
      { uid: "u0", id: "injected", name: "Injected", type: "injected" },
      metamask,
      { uid: "u2", id: "io.rabby", name: "Rabby", type: "injected", icon: "https://evil/icon.png" },
    ];
    renderPay();

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["MetaMask", "Rabby"]);

    await user.click(screen.getByRole("button", { name: "MetaMask" }));
    expect(actions.connect).toHaveBeenCalledWith(expect.anything(), {
      connector: metamask,
      chainId: 8453,
    });
  });

  it("sem carteira → estado vazio em uma linha", () => {
    renderPay();
    expect(screen.getByText(/No wallet found/)).toBeInTheDocument();
  });
});

describe("EvmWalletPay — pagar", () => {
  it("assina a mensagem de posse ANTES de enviar e repassa {txHash, payer, signature}", async () => {
    const user = userEvent.setup();
    connected();
    const order: string[] = [];
    actions.signMessage.mockImplementation(async () => (order.push("sign"), "0xsig"));
    actions.sendTransaction.mockImplementation(async () => (order.push("send"), "0xhash"));
    const { onSent } = renderPay();

    expect(screen.getByText("100 USDC")).toBeInTheDocument();
    expect(screen.getByText("on Base")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    expect(order).toEqual(["sign", "send"]);
    expect(actions.switchChain).not.toHaveBeenCalled();
    expect(actions.signMessage).toHaveBeenCalledWith(expect.anything(), {
      account: PAYER,
      message: "DeepAlpha: I own this wallet (payment pay1)",
    });

    const [, tx] = actions.sendTransaction.mock.calls[0];
    expect(tx.to).toBe(USDC_BASE);
    expect(tx.chainId).toBe(8453);
    expect(tx.value).toBeUndefined();
    const decoded = decodeFunctionData({ abi: erc20Abi, data: tx.data });
    expect(decoded.functionName).toBe("transfer");
    expect(decoded.args).toEqual([RECEIVER, BigInt(100_000_000)]);

    expect(onSent).toHaveBeenCalledWith({ txHash: "0xhash", payer: PAYER, signature: "0xsig" });
  });

  it("assinatura recusada → NÃO envia nada e mostra o motivo", async () => {
    const user = userEvent.setup();
    connected();
    actions.signMessage.mockRejectedValue({ name: "UserRejectedRequestError", code: 4001 });
    const { onSent } = renderPay();

    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    expect(actions.sendTransaction).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("You cancelled the request in your wallet.");
    expect(screen.getByRole("button", { name: "Pay 100 USDC" })).toBeEnabled();
  });

  it("envio recusado depois de assinar → sem onSent, erro inline", async () => {
    const user = userEvent.setup();
    connected();
    actions.signMessage.mockResolvedValue("0xsig");
    actions.sendTransaction.mockRejectedValue({ cause: { code: 4001 } });
    const { onSent } = renderPay();

    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    expect(onSent).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("You cancelled the request in your wallet.");
  });

  it("carteira em outra rede → troca de rede antes de assinar", async () => {
    const user = userEvent.setup();
    connected(1);
    const order: string[] = [];
    actions.switchChain.mockImplementation(async () => order.push("switch"));
    actions.signMessage.mockImplementation(async () => (order.push("sign"), "0xsig"));
    actions.sendTransaction.mockImplementation(async () => (order.push("send"), "0xhash"));
    renderPay();

    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    expect(actions.switchChain).toHaveBeenCalledWith(expect.anything(), { chainId: 8453 });
    expect(order).toEqual(["switch", "sign", "send"]);
  });

  it("BSC (Binance-Peg, 18 casas): valor convertido sem perda", async () => {
    const user = userEvent.setup();
    connected(56);
    actions.signMessage.mockResolvedValue("0xsig");
    actions.sendTransaction.mockResolvedValue("0xhash");
    renderPay(
      payment({
        chain: "BSC",
        chainId: 56,
        tokenDecimals: 18,
        tokenAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    const [, tx] = actions.sendTransaction.mock.calls[0];
    expect(decodeFunctionData({ abi: erc20Abi, data: tx.data }).args).toEqual([
      RECEIVER,
      BigInt("100000000000000000000"),
    ]);
  });

  it("cobrança sem mensagem de posse → não assina nem envia", async () => {
    const user = userEvent.setup();
    connected();
    const { onSent } = renderPay(payment({ ownershipMessage: null }));

    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    expect(actions.signMessage).not.toHaveBeenCalled();
    expect(actions.sendTransaction).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("erro vindo do modal aparece sob o botão; Change desconecta", async () => {
    const user = userEvent.setup();
    connected();
    renderPay(payment(), "This transaction does not pay this charge.");

    expect(screen.getByRole("alert")).toHaveTextContent("This transaction does not pay this charge.");
    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(actions.disconnect).toHaveBeenCalled();
  });
});
