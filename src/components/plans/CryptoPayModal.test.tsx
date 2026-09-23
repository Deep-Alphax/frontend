import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { CryptoPayModal } from "./CryptoPayModal";
import * as api from "@/lib/api/billing";
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

const createPay = vi.mocked(api.createCryptoPayment);
const getPay = vi.mocked(api.getCryptoPayment);
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
    amount: "50.012345",
    receiver: "0x184f309b7D9f4c2430506831778173ecDAC55B84",
    reference: null,
    paymentUri:
      "ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?address=0x184f309b7D9f4c2430506831778173ecDAC55B84&uint256=50012345",
    qrDataUrl: "data:image/png;base64,QR",
    periodDays: 30,
    expiresAt: inOneHour(),
    confirmedAt: null,
    txHash: null,
    declaredPayer: null,
    ...over,
  };
}

const SOLANA_PAYMENT = payment({
  id: "sol1",
  chain: "SOLANA",
  amount: "50",
  receiver: "BLNe5umxS7QGZPxvYAq3Favrs4hdeS47nThytnfFoE4u",
  reference: "Ref1111111111111111111111111111111111111111",
  paymentUri:
    "solana:BLNe5umxS7QGZPxvYAq3Favrs4hdeS47nThytnfFoE4u?amount=50&reference=Ref1",
  qrDataUrl: "data:image/png;base64,SOLQR",
});

function renderModal(
  props: Partial<Parameters<typeof CryptoPayModal>[0]> = {},
) {
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

/** Abre o dropdown de rede e escolhe a opção (sem confirmar). */
async function selectChain(user: User, label: RegExp) {
  await user.click(screen.getByRole("combobox", { name: "Network" }));
  await user.click(await screen.findByRole("option", { name: label }));
}

/** Escolhe a rede no dropdown e confirma em "Continue". */
async function pickChain(user: User, label: RegExp) {
  await selectChain(user, label);
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

/** Opções visíveis no dropdown aberto. */
async function openOptions(user: User) {
  await user.click(screen.getByRole("combobox", { name: "Network" }));
  const list = await screen.findByRole("listbox");
  return Array.from(list.querySelectorAll('[role="option"]')).map((o) => o.textContent);
}

describe("CryptoPayModal — seletor de rede", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("é um dropdown (combobox) que lista SÓ as redes recebidas, com rótulos", async () => {
    const user = userEvent.setup();
    renderModal({ chains: ["SOLANA", "ETHEREUM", "BSC"] });

    expect(screen.getByRole("combobox", { name: "Network" })).toHaveTextContent(
      "Select a network",
    );
    expect(await openOptions(user)).toEqual([
      "USDC on Solana",
      "USDC on Ethereum",
      "USDC on BNB Chain",
    ]);
  });

  it("mostra a nota da rede escolhida (Ethereum: taxa; BSC: Binance-Peg)", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.queryByText("higher network fee")).not.toBeInTheDocument();

    await selectChain(user, /USDC on Ethereum/);
    expect(screen.getByText("higher network fee")).toBeInTheDocument();

    await selectChain(user, /USDC on BNB Chain/);
    expect(screen.getByText("Binance-Peg USDC (BEP-20)")).toBeInTheDocument();
    expect(screen.queryByText("higher network fee")).not.toBeInTheDocument();
  });

  it("Continue fica desabilitado até escolher uma rede, e escolher NÃO cria cobrança", async () => {
    const user = userEvent.setup();
    renderModal();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await selectChain(user, /USDC on Base/);
    expect(screen.getByRole("combobox", { name: "Network" })).toHaveTextContent("USDC on Base");
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
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Com o dropdown já fechado, o próximo Esc fecha o modal.
    await new Promise((r) => setTimeout(r, 0));
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fechado não renderiza nada", () => {
    renderModal({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("clicar numa rede cria a cobrança nela e trava os botões enquanto prepara", async () => {
    const user = userEvent.setup();
    let resolve!: (p: api.CryptoPayment) => void;
    createPay.mockReturnValue(new Promise((r) => (resolve = r)));
    renderModal();

    await pickChain(user, /USDC on Arbitrum/);

    expect(createPay.mock.calls[0][0]).toBe("ARBITRUM");
    expect(await screen.findByRole("button", { name: "Preparing…" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Network" })).toBeDisabled();

    await act(async () => resolve(payment({ chain: "ARBITRUM" })));
    expect(await screen.findByRole("link", { name: "Open in wallet" })).toBeInTheDocument();
  });

  it("erro ao criar → toast de erro e continua no seletor", async () => {
    const user = userEvent.setup();
    createPay.mockRejectedValue(new Error("boom"));
    renderModal();

    await pickChain(user, /USDC on Base/);

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe(
      "Something went wrong. Please try again.",
    );
    // Continua no seletor, com a rede escolhida, pronto para tentar de novo.
    expect(screen.getByRole("combobox", { name: "Network" })).toHaveTextContent("USDC on Base");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});

describe("CryptoPayModal — tela de pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passos na ordem: 1) sua carteira, 2) enviar 50 USDC para o destino, 3) avisar", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(SOLANA_PAYMENT);
    renderModal();

    await pickChain(user, /USDC on Solana/);

    const steps = await screen.findAllByRole("region", { name: /^Step [0-9]$/ });
    expect(steps.map((s) => s.getAttribute("aria-label"))).toEqual([
      "Step 1",
      "Step 2",
      "Step 3",
    ]);
    // 1: a carteira vem ANTES do envio (é ela que liga o pagamento redondo à conta).
    expect(steps[0]).toContainElement(screen.getByLabelText("Your wallet address"));
    // 2: pede o valor cheio, na rede escolhida, com o destino copiável.
    expect(steps[1]).toHaveTextContent("Send 50 USDC on Solana");
    expect(screen.getByTestId("receiver")).toHaveTextContent(SOLANA_PAYMENT.receiver);
    expect(
      screen.getByText(/Send at least 50 USDC on Solana, from the wallet above/),
    ).toBeInTheDocument();
    // 3: o botão de avisar.
    expect(steps[2]).toContainElement(
      screen.getByRole("button", { name: "I've sent the payment" }),
    );
  });

  it("EVM: pede 50 USDC na rede escolhida; o QR leva o valor exato com os centavos", async () => {
    const user = userEvent.setup();
    const p = payment();
    createPay.mockResolvedValue(p);
    renderModal();

    await pickChain(user, /USDC on Base/);

    expect(await screen.findByText("Send 50 USDC on Base")).toBeInTheDocument();
    expect(screen.getByTestId("receiver")).toHaveTextContent(p.receiver);
    // Os centavos únicos não são pedidos ao usuário; aparecem só no atalho do QR.
    expect(screen.queryByText(/Send exactly/)).not.toBeInTheDocument();
    expect(screen.getByText(/The QR fills in 50.012345 USDC/)).toBeInTheDocument();
    expect(screen.getByAltText("Payment QR code for USDC on Base")).toHaveAttribute(
      "src",
      p.qrDataUrl,
    );
    expect(screen.getByRole("link", { name: "Open in wallet" })).toHaveAttribute(
      "href",
      p.paymentUri,
    );
  });

  it("Copy copia o endereço de destino exato", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const p = payment();
    createPay.mockResolvedValue(p);
    renderModal();

    await pickChain(user, /USDC on Base/);
    await user.click(await screen.findByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith(p.receiver);
    expect(toast.success).toHaveBeenCalledWith("Address copied");
  });

  it("Copy sem permissão de clipboard → toast de erro, sem quebrar", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    createPay.mockResolvedValue(payment());
    renderModal();

    await pickChain(user, /USDC on Base/);
    await user.click((await screen.findAllByRole("button", { name: "Copy" }))[0]);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Could not copy — select and copy it manually.",
      ),
    );
  });

  it("prazo vencido → avisa que ainda credita quem já pagou", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(
      payment({ expiresAt: new Date(Date.now() - 60_000).toISOString() }),
    );
    renderModal();

    await pickChain(user, /USDC on Base/);

    expect(await screen.findByText(/This window has expired/)).toBeInTheDocument();
    expect(screen.queryByText(/Waiting for payment/)).not.toBeInTheDocument();
  });

  it("dentro do prazo → aguardando pagamento", async () => {
    const user = userEvent.setup();
    createPay.mockResolvedValue(payment());
    renderModal();

    await pickChain(user, /USDC on Base/);

    expect(await screen.findByText(/Waiting for payment/)).toBeInTheDocument();
  });
});

describe("CryptoPayModal — polling e confirmação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("PENDING → CONFIRMED: mostra 'Payment received' e invalida plano e detalhes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    createPay.mockResolvedValue(payment());
    getPay
      .mockResolvedValueOnce(payment())
      .mockResolvedValue(
        payment({ status: "CONFIRMED", confirmedAt: new Date().toISOString() }),
      );
    const { client } = renderModal();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await pickChain(user, /USDC on Base/);
    expect(await screen.findByText(/Waiting for payment/)).toBeInTheDocument();

    // 1º ciclo: ainda pendente.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(getPay).toHaveBeenCalledWith("pay1");
    expect(screen.queryByText("Payment received")).not.toBeInTheDocument();

    // 2º ciclo: confirmado.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText(/30 days of Pro were added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change network" })).not.toBeInTheDocument();

    const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toContain(JSON.stringify(api.PLAN_KEY));
    expect(keys).toContain(JSON.stringify(api.BILLING_DETAILS_KEY));

    // Confirmado → para de consultar.
    const calls = getPay.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(getPay.mock.calls.length).toBe(calls);
  });

  it("enquanto PENDING continua consultando a cada 5s", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    createPay.mockResolvedValue(payment());
    getPay.mockResolvedValue(payment());
    renderModal();

    await pickChain(user, /USDC on Base/);
    await screen.findByText(/Waiting for payment/);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(getPay.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe("CryptoPayModal — navegação e fechamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPay.mockResolvedValue(payment());
  });

  it("'Change network' volta ao seletor", async () => {
    const user = userEvent.setup();
    renderModal();

    await pickChain(user, /USDC on Base/);
    await user.click(await screen.findByRole("button", { name: "Change network" }));

    expect(screen.getByRole("combobox", { name: "Network" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in wallet" })).not.toBeInTheDocument();
  });

  it("Close chama onClose", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    const closes = screen.getAllByRole("button", { name: "Close" });
    // Botão do rodapé é o último "Close" (o primeiro é o scrim).
    await user.click(closes[closes.length - 1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("scrim chama onClose", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Esc chama onClose", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fechar na tela de pagamento e reabrir começa no seletor", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = renderWithQuery(
      <CryptoPayModal open chains={ALL} amount="50" periodDays={30} onClose={onClose} />,
    );

    await pickChain(user, /USDC on Base/);
    await screen.findByRole("link", { name: "Open in wallet" });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <CryptoPayModal open={false} chains={ALL} amount="50" periodDays={30} onClose={onClose} />,
    );
    rerender(
      <CryptoPayModal open chains={ALL} amount="50" periodDays={30} onClose={onClose} />,
    );

    expect(await screen.findByRole("combobox", { name: "Network" })).toHaveTextContent(
      "Select a network",
    );
    expect(screen.queryByRole("link", { name: "Open in wallet" })).not.toBeInTheDocument();
  });
});

describe("CryptoPayModal — \"I've sent the payment\"", () => {
  const WALLET = "0x3a1b2c3d4e5f60718293a4b5c6d7e8f901a2b3c4";

  beforeEach(() => {
    vi.clearAllMocks();
    createPay.mockResolvedValue(payment());
    getPay.mockResolvedValue(payment());
  });

  async function openPayStep(user: User) {
    renderModal();
    await pickChain(user, /USDC on Base/);
    return screen.findByLabelText("Your wallet address");
  }

  it("botão desabilitado até preencher a carteira", async () => {
    const user = userEvent.setup();
    const input = await openPayStep(user);
    const btn = screen.getByRole("button", { name: "I've sent the payment" });
    expect(btn).toBeDisabled();
    await user.type(input, "   ");
    expect(btn).toBeDisabled();
    await user.type(input, WALLET);
    expect(btn).toBeEnabled();
  });

  it("envia id da cobrança + carteira (sem espaços) e, se achou, mostra confirmado", async () => {
    const user = userEvent.setup();
    submitPay.mockResolvedValue(
      payment({ status: "CONFIRMED", declaredPayer: WALLET, confirmedAt: new Date().toISOString() }),
    );
    const input = await openPayStep(user);
    await user.type(input, `  ${WALLET}  `);
    await user.click(screen.getByRole("button", { name: "I've sent the payment" }));

    expect(submitPay).toHaveBeenCalledWith("pay1", WALLET);
    expect(await screen.findByText("Payment received")).toBeInTheDocument();
  });

  it("Enter no campo também envia", async () => {
    const user = userEvent.setup();
    submitPay.mockResolvedValue(payment({ declaredPayer: WALLET }));
    const input = await openPayStep(user);
    await user.type(input, `${WALLET}{Enter}`);
    expect(submitPay).toHaveBeenCalledWith("pay1", WALLET);
  });

  it("ainda não achou: avisa que continua procurando e segue pendente", async () => {
    const user = userEvent.setup();
    submitPay.mockResolvedValue(payment({ declaredPayer: WALLET }));
    const input = await openPayStep(user);
    await user.type(input, WALLET);
    await user.click(screen.getByRole("button", { name: "I've sent the payment" }));

    expect(
      await screen.findByText(/We haven't found your payment from this wallet yet/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Payment received")).not.toBeInTheDocument();
  });

  it("enquanto consulta, o botão mostra 'Checking…' e fica travado", async () => {
    const user = userEvent.setup();
    let resolve!: (p: api.CryptoPayment) => void;
    submitPay.mockReturnValue(new Promise((r) => (resolve = r)));
    const input = await openPayStep(user);
    await user.type(input, WALLET);
    await user.click(screen.getByRole("button", { name: "I've sent the payment" }));

    expect(await screen.findByRole("button", { name: "Checking…" })).toBeDisabled();
    await act(async () => resolve(payment({ declaredPayer: WALLET })));
  });

  it("endereço recusado pelo servidor: mostra a mensagem no campo", async () => {
    const user = userEvent.setup();
    const { AxiosError } = await import("axios");
    const err = new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      data: { message: "Invalid EVM address (0x followed by 40 hex characters)." },
    } as never);
    submitPay.mockRejectedValue(err);
    const input = await openPayStep(user);
    await user.type(input, "0x123");
    await user.click(screen.getByRole("button", { name: "I've sent the payment" }));

    expect(
      await screen.findByText("Invalid EVM address (0x followed by 40 hex characters)."),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("erro de uma cobrança não aparece depois de trocar de rede", async () => {
    const user = userEvent.setup();
    const { AxiosError } = await import("axios");
    submitPay.mockRejectedValue(
      new AxiosError("Bad Request", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 400,
        data: { message: "Invalid EVM address (0x followed by 40 hex characters)." },
      } as never),
    );
    const input = await openPayStep(user);
    await user.type(input, "0x123");
    await user.click(screen.getByRole("button", { name: "I've sent the payment" }));
    await screen.findByText(/Invalid EVM address/);

    await user.click(screen.getByRole("button", { name: "Change network" }));
    createPay.mockResolvedValue(payment({ id: "pay2" }));
    getPay.mockResolvedValue(payment({ id: "pay2" }));
    await pickChain(user, /USDC on Base/);

    await screen.findByLabelText("Your wallet address");
    expect(screen.queryByText(/Invalid EVM address/)).not.toBeInTheDocument();
  });
});
