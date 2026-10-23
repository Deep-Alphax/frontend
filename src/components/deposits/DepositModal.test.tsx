import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { DepositButton } from "./DepositButton";
// Carrega o chunk do modal já aqui: o `lazy` do botão resolve na hora nos testes.
import "./DepositModal";
import { WalletChip } from "@/components/home/WalletChip";
import { useDepositModal } from "@/lib/store/depositModal";
import * as api from "@/lib/api/deposits";
import * as walletsApi from "@/lib/api/wallets";

vi.mock("@/lib/api/deposits", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getDepositOptions: vi.fn(),
    getDepositQuote: vi.fn(),
    createDeposit: vi.fn(),
    getDeposit: vi.fn(),
    listDeposits: vi.fn(),
  };
});
vi.mock("@/lib/api/wallets", async (importOriginal) => {
  const actual = await importOriginal<typeof walletsApi>();
  return { ...actual, getWallets: vi.fn() };
});
vi.mock("@/lib/auth/useSession", () => ({
  useSession: () => ({ isAuthenticated: true, isLoading: false, profile: undefined }),
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const getOptions = vi.mocked(api.getDepositOptions);
const getQuote = vi.mocked(api.getDepositQuote);
const create = vi.mocked(api.createDeposit);
const getDeposit = vi.mocked(api.getDeposit);
const list = vi.mocked(api.listDeposits);
const getWallets = vi.mocked(walletsApi.getWallets);

const SOL_ADDR = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const EVM_ADDR = "0x52908400098527886E0F7030069857D2E4169EE7";

const OPTIONS: api.DepositOptions = {
  enabled: true,
  assets: [
    { chain: "SOLANA", symbol: "SOL", name: "Solana", native: true },
    { chain: "SOLANA", symbol: "USDC", name: "USD Coin", native: false },
    { chain: "BASE", symbol: "ETH", name: "Ether", native: true },
    { chain: "BASE", symbol: "USDC", name: "USD Coin", native: false },
  ],
  minBrlCents: 51_837,
  maxBrlCents: 500_000,
  dailyLeftBrlCents: 500_000,
  feeBps: 100,
  brlPerUsdt: 5.42,
};

const WALLETS: walletsApi.Wallet[] = [
  { id: "w1", chain: "SOLANA", address: SOL_ADDR, label: "Main", role: "TRACKED", syncStatus: "SYNCED" },
  { id: "w2", chain: "BASE", address: EVM_ADDR, label: null, role: "TRACKED", syncStatus: "SYNCED" },
];

const PENDING: api.DepositView = {
  id: "dep_1",
  status: "PENDING",
  chain: "BASE",
  symbol: "ETH",
  toAddress: EVM_ADDR,
  amountBrlCents: 100_000,
  usdt: "184.500000",
  brlPerUsdt: "5.420000",
  qrCopyPaste: "00020101021226PIXCODE6304ABCD",
  qrImage: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  paidAt: null,
  deliveredAmount: null,
  deliveredAt: null,
  txUrl: null,
  orderUrl: null,
  error: null,
  createdAt: "2026-10-22T12:00:00.000Z",
};

const AFTER_PIX = { qrCopyPaste: null, qrImage: null, paidAt: "2026-10-22T12:01:00.000Z" };

function renderHeader() {
  return renderWithQuery(
    <>
      <DepositButton />
      <WalletChip />
    </>,
  );
}

async function openFromHeader(user: ReturnType<typeof userEvent.setup>, ready = true) {
  await user.click(screen.getByRole("button", { name: "Deposit" }));
  const dialog = await screen.findByRole("dialog", { name: "Deposit with Pix" });
  // Opções + carteiras carregadas: o formulário está pronto.
  if (ready) await within(dialog).findByLabelText("Amount");
  return dialog;
}

describe("DepositModal", () => {
  beforeEach(() => {
    // reset (não só clear): sobra de `mockResolvedValueOnce` de um teste não vaza no próximo.
    vi.resetAllMocks();
    useDepositModal.setState({ open: false, preset: null });
    getOptions.mockResolvedValue(OPTIONS);
    getWallets.mockResolvedValue(WALLETS);
    list.mockResolvedValue([]);
    getQuote.mockImplementation(async (p) => ({
      amountBrlCents: p.amountBrlCents,
      usdt: "184.500000",
      estimatedOut: p.symbol === "SOL" ? "0.421337" : "0.0612",
      symbol: p.symbol,
      etaSeconds: p.chain === "SOLANA" ? 60 : 180,
    }));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("abre pelo botão Deposit do header, com a 1ª moeda e a carteira da rede", async () => {
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openFromHeader(user);

    expect(await within(dialog).findByRole("combobox", { name: "Coin and network" })).toHaveTextContent(
      "SOL on Solana",
    );
    expect(await within(dialog).findByTestId("deposit-dest-address")).toHaveTextContent(SOL_ADDR);
    expect(within(dialog).getByText(/Minimum R\$ 519 \(US\$ 100\) · Maximum R\$ 5\.000/)).toBeInTheDocument();
    expect(within(dialog).getByText(/can't be reversed/)).toBeInTheDocument();
  });

  it("a ação da carteira no chip abre com ela de destino e a rede dela", async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(await screen.findByRole("button", { name: /2 Wallets/ }));
    await user.click(await screen.findByRole("button", { name: "Deposit with Pix to Wallet 2" }));

    const dialog = await screen.findByRole("dialog", { name: "Deposit with Pix" });
    expect(await within(dialog).findByRole("combobox", { name: "Coin and network" })).toHaveTextContent(
      "ETH on Base",
    );
    expect(await within(dialog).findByTestId("deposit-dest-address")).toHaveTextContent(EVM_ADDR);
  });

  it("valida o endereço colado e não gera Pix com endereço inválido", async () => {
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openFromHeader(user);

    await user.click(await within(dialog).findByRole("combobox", { name: "Destination wallet" }));
    await user.click(await screen.findByRole("option", { name: "Paste another address" }));
    const input = within(dialog).getByLabelText("Solana address");
    await user.type(input, EVM_ADDR);
    await user.tab();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/EVM \(0x\) address/);

    await user.clear(input);
    await user.type(input, "notanaddress");
    await user.click(within(dialog).getByRole("button", { name: "R$ 1.000" }));
    await user.click(within(dialog).getByRole("button", { name: /Generate Pix/ }));
    expect(within(dialog).getByText("Not a valid Solana address.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("mostra a cotação (com taxa) depois de digitar o valor", async () => {
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openFromHeader(user);

    await user.type(within(dialog).getByLabelText("Amount"), "1.000");
    expect(await within(dialog).findByTestId("deposit-quote-out")).toHaveTextContent("≈ 0.4213 SOL");
    expect(getQuote).toHaveBeenLastCalledWith({ chain: "SOLANA", symbol: "SOL", amountBrlCents: 100_000 });
    expect(within(dialog).getByText(/≈ 1 min after the Pix · on Solana/)).toBeInTheDocument();
    expect(within(dialog).getByText("Service fee")).toBeInTheDocument();
    expect(within(dialog).getByText("1%")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Generate Pix · R$ 1.000,00" })).toBeInTheDocument();
  });

  it("valor abaixo do mínimo mostra o erro e não gera", async () => {
    const user = userEvent.setup();
    renderHeader();
    const dialog = await openFromHeader(user);
    await user.type(within(dialog).getByLabelText("Amount"), "100");
    await user.tab();
    expect(within(dialog).getByText("Minimum is R$ 519.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Generate Pix/ }));
    expect(create).not.toHaveBeenCalled();
  });

  it("gera o Pix → QR → acompanha até DELIVERED com os links", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    create.mockResolvedValue(PENDING);
    getDeposit
      .mockResolvedValueOnce({ ...PENDING, ...AFTER_PIX, status: "PAID" })
      .mockResolvedValueOnce({
        ...PENDING,
        ...AFTER_PIX,
        status: "SENT",
        txUrl: "https://solscan.io/tx/abc",
        orderUrl: "https://app.debridge.finance/order?orderId=0x1",
      })
      .mockResolvedValue({
        ...PENDING,
        ...AFTER_PIX,
        status: "DELIVERED",
        txUrl: "https://solscan.io/tx/abc",
        orderUrl: "https://app.debridge.finance/order?orderId=0x1",
        deliveredAmount: "0.061234",
        deliveredAt: "2026-10-22T12:04:00.000Z",
      });

    renderHeader();
    const dialog = await openFromHeader(user);
    // Troca para ETH na Base: o destino passa para a carteira da Base.
    await user.click(await within(dialog).findByRole("combobox", { name: "Coin and network" }));
    await user.click(await screen.findByRole("option", { name: /ETH · Ether on Base/ }));
    expect(await within(dialog).findByTestId("deposit-dest-address")).toHaveTextContent(EVM_ADDR);

    await user.click(within(dialog).getByRole("button", { name: "R$ 1.000" }));
    await user.click(within(dialog).getByRole("button", { name: "Generate Pix · R$ 1.000,00" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        { chain: "BASE", symbol: "ETH", toAddress: EVM_ADDR, amountBrlCents: 100_000 },
        expect.anything(),
      ),
    );
    expect(await within(dialog).findByRole("img", { name: "Pix QR code" })).toHaveAttribute("src", PENDING.qrImage);
    expect(within(dialog).getByLabelText("Pix copy and paste")).toHaveValue(PENDING.qrCopyPaste);
    expect(within(dialog).getByText(/Expires in/)).toHaveTextContent(/1[45]:\d\d/);
    await user.click(within(dialog).getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(PENDING.qrCopyPaste);

    // PENDING consulta a cada 3 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    const progress = await within(dialog).findByRole("list", { name: "Deposit progress" });
    expect(within(progress).getByText("Pix received")).toBeInTheDocument();
    expect(getDeposit).toHaveBeenCalledWith("dep_1");

    // Entregando: a cada 5 s.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await within(dialog).findByText("Bridging to Base")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Track transfer" })).toHaveAttribute(
      "href",
      "https://app.debridge.finance/order?orderId=0x1",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await within(dialog).findByRole("heading", { name: "Delivered" })).toBeInTheDocument();
    expect(within(dialog).getByText("Delivered · 0.06123 ETH")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "View transaction" })).toHaveAttribute(
      "href",
      "https://solscan.io/tx/abc",
    );
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument();

    // Entregue: para de consultar.
    const calls = getDeposit.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(getDeposit).toHaveBeenCalledTimes(calls);
  });

  it("depósito FAILED reaberto pela lista mostra o erro e o suporte", async () => {
    const user = userEvent.setup();
    const failed: api.DepositView = {
      ...PENDING,
      ...AFTER_PIX,
      id: "dep_9",
      chain: "SOLANA",
      symbol: "SOL",
      toAddress: SOL_ADDR,
      status: "FAILED",
      error: "The swap could not be completed.",
    };
    list.mockResolvedValue([failed]);
    getDeposit.mockResolvedValue(failed);
    renderHeader();
    const dialog = await openFromHeader(user);

    const recent = await within(dialog).findByRole("region", { name: "Recent deposits" });
    expect(within(recent).getByText("Failed")).toBeInTheDocument();
    await user.click(within(recent).getByRole("button", { name: /Open deposit of R\$ 1\.000,00 in SOL/ }));

    expect(await within(dialog).findByRole("heading", { name: "Deposit failed" })).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent("The swap could not be completed.");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/Contact support with reference dep_9/);
    expect(within(dialog).getByText(/Sending SOL/)).toBeInTheDocument();
  });

  it("QR vencido: 'Start again' volta ao formulário", async () => {
    const user = userEvent.setup();
    create.mockResolvedValue({ ...PENDING, chain: "SOLANA", symbol: "SOL", status: "EXPIRED", qrCopyPaste: null, qrImage: null });
    renderHeader();
    const dialog = await openFromHeader(user);
    await within(dialog).findByTestId("deposit-dest-address");
    await user.click(within(dialog).getByRole("button", { name: "R$ 600" }));
    await user.click(within(dialog).getByRole("button", { name: /Generate Pix/ }));

    expect(await within(dialog).findByText("This QR code expired")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Start again" }));
    // Volta com o valor que já estava escolhido.
    const cta = within(dialog).getByRole("button", { name: "Generate Pix · R$ 600,00" });
    expect(cta.closest("[hidden]")).toBeNull();
  });

  it("opções desligadas no servidor: aviso em vez do formulário", async () => {
    const user = userEvent.setup();
    getOptions.mockResolvedValue({ ...OPTIONS, enabled: false });
    renderHeader();
    const dialog = await openFromHeader(user, false);
    expect(await within(dialog).findByText("Deposits are unavailable right now")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Generate Pix/ })).not.toBeInTheDocument();
  });

  it("limite diário esgotado bloqueia a geração", async () => {
    const user = userEvent.setup();
    getOptions.mockResolvedValue({ ...OPTIONS, dailyLeftBrlCents: 0 });
    renderHeader();
    const dialog = await openFromHeader(user);
    expect(await within(dialog).findByText(/reached today's deposit limit/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Generate Pix" })).toBeDisabled();
  });

  it("Esc fecha", async () => {
    const user = userEvent.setup();
    renderHeader();
    await openFromHeader(user);
    await user.keyboard("{Escape}");
    expect(useDepositModal.getState().open).toBe(false);
  });
});
