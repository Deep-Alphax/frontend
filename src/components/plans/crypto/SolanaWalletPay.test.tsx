import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import bs58 from "bs58";

import type { CryptoPayment } from "@/lib/api/billing";
import * as api from "@/lib/api/billing";
import * as transfer from "@/lib/crypto/solanaTransfer";
import SolanaWalletPay from "./SolanaWalletPay";

/*
 * wallet-adapter na fronteira. A montagem da instrução SPL tem teste próprio
 * (`solanaTransfer.test.ts`); aqui importa que a carteira ASSINA E TRANSMITE
 * (signAndSendTransaction do Wallet Standard), com o blockhash da nossa API, e
 * que o hash devolvido é o da carteira.
 */
const PAYER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const SIG = new Uint8Array(64).fill(7);

const w = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock("@solana/wallet-adapter-react", () => ({
  WalletProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useWallet: () => w.state,
}));
vi.mock("@/lib/api/billing", async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  getSolanaBlockhash: vi.fn(),
}));
vi.mock("@/lib/crypto/solanaTransfer", () => ({ buildUsdcTransfer: vi.fn() }));

function payment(): CryptoPayment {
  return {
    id: "sol1",
    chain: "SOLANA",
    status: "PENDING",
    token: "USDC",
    tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    tokenDecimals: 6,
    chainId: null,
    amount: "100",
    receiver: "BLNe5umxS7QGZPxvYAq3Favrs4hdeS47nThytnfFoE4u",
    reference: "Ref1111111111111111111111111111111111111111",
    periodDays: 30,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    confirmedAt: null,
    txHash: null,
    submittedTxHash: null,
    declaredPayer: null,
    ownershipMessage: null,
  };
}

function stdAdapter(name: string, signAndSend?: ReturnType<typeof vi.fn>) {
  return {
    name,
    icon: "data:image/svg+xml;base64,x",
    wallet: {
      accounts: [{ address: PAYER, chains: ["solana:mainnet"] }],
      features: signAndSend
        ? { "solana:signAndSendTransaction": { signAndSendTransaction: signAndSend } }
        : { "solana:signTransaction": {} },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  w.state = {};
});

describe("SolanaWalletPay", () => {
  it("lista só carteiras instaladas que transmitem sozinhas; clicar conecta", async () => {
    const user = userEvent.setup();
    const connect = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn();
    const phantom = stdAdapter("Phantom", vi.fn());
    w.state = {
      wallets: [
        { adapter: phantom, readyState: "Installed" },
        { adapter: stdAdapter("SignOnly"), readyState: "Installed" },
        { adapter: stdAdapter("NotInstalled", vi.fn()), readyState: "NotDetected" },
      ],
      // Já selecionada de uma sessão anterior → conecta direto.
      wallet: { adapter: phantom },
      select,
      connect,
      disconnect: vi.fn(),
      connected: false,
      publicKey: null,
    };
    render(<SolanaWalletPay payment={payment()} network="Solana" busy={false} error={null} onSent={vi.fn()} />);

    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Phantom"]);
    await user.click(screen.getByRole("button", { name: "Phantom" }));
    expect(connect).toHaveBeenCalled();
  });

  it("paga: blockhash da API → carteira assina e transmite → hash base58 + pagador", async () => {
    const user = userEvent.setup();
    const signAndSend = vi.fn().mockResolvedValue([{ signature: SIG }]);
    const adapter = stdAdapter("Phantom", signAndSend);
    const { PublicKey } = await import("@solana/web3.js");
    const publicKey = new PublicKey(PAYER);
    w.state = {
      wallets: [{ adapter, readyState: "Installed" }],
      wallet: { adapter },
      select: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
      publicKey,
    };
    vi.mocked(api.getSolanaBlockhash).mockResolvedValue({
      blockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k",
      lastValidBlockHeight: 99,
    });
    const serialize = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
    vi.mocked(transfer.buildUsdcTransfer).mockReturnValue({ serialize } as never);
    const onSent = vi.fn();
    render(<SolanaWalletPay payment={payment()} network="Solana" busy={false} error={null} onSent={onSent} />);

    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    expect(transfer.buildUsdcTransfer).toHaveBeenCalledWith({
      payer: publicKey,
      receiver: payment().receiver,
      mint: payment().tokenAddress,
      reference: payment().reference,
      amount: BigInt(100_000_000),
      decimals: 6,
      blockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k",
      lastValidBlockHeight: 99,
    });
    expect(serialize).toHaveBeenCalledWith({ requireAllSignatures: false, verifySignatures: false });
    expect(signAndSend).toHaveBeenCalledWith({
      account: adapter.wallet.accounts[0],
      chain: "solana:mainnet",
      transaction: new Uint8Array([1, 2, 3]),
    });
    expect(onSent).toHaveBeenCalledWith({ txHash: bs58.encode(SIG), payer: PAYER });
  });

  it("recusa na carteira → sem onSent, erro inline", async () => {
    const user = userEvent.setup();
    const signAndSend = vi.fn().mockRejectedValue(new Error("User rejected the request."));
    const adapter = stdAdapter("Phantom", signAndSend);
    const { PublicKey } = await import("@solana/web3.js");
    w.state = {
      wallets: [{ adapter, readyState: "Installed" }],
      wallet: { adapter },
      select: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
      publicKey: new PublicKey(PAYER),
    };
    vi.mocked(api.getSolanaBlockhash).mockResolvedValue({ blockhash: "x", lastValidBlockHeight: 1 });
    vi.mocked(transfer.buildUsdcTransfer).mockReturnValue({
      serialize: () => new Uint8Array([1]),
    } as never);
    const onSent = vi.fn();
    render(<SolanaWalletPay payment={payment()} network="Solana" busy={false} error={null} onSent={onSent} />);

    await user.click(screen.getByRole("button", { name: "Pay 100 USDC" }));

    expect(onSent).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("You cancelled the request in your wallet.");
  });
});
