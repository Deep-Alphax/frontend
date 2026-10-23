import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";

import { renderWithQuery } from "@/test/queryWrapper";
import { PixPayModal } from "./PixPayModal";
import * as api from "@/lib/api/billing";

vi.mock("@/lib/api/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, createPixPayment: vi.fn(), getPixPayment: vi.fn() };
});
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const createPix = vi.mocked(api.createPixPayment);
const getPix = vi.mocked(api.getPixPayment);

const PENDING: api.PixPayment = {
  id: "pix_1",
  status: "PENDING",
  amountBrlCents: 59136,
  amountUsdCents: 10000,
  fxRate: "5.913600",
  periodDays: 30,
  qrCopyPaste: "00020101021226PIXCODE6304ABCD",
  qrImage: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
};

function open(onClose = vi.fn()) {
  renderWithQuery(
    <PixPayModal open quoteBrlCents={59136} periodDays={30} onClose={onClose} />,
  );
  return onClose;
}

async function generate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Generate Pix/ }));
}

describe("PixPayModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra o valor em reais e não pede dado do pagador", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Pay with Pix" });
    expect(dialog).toHaveTextContent("R$ 591,36 · 30 days of Pro · doesn't renew");
    expect(dialog).toHaveTextContent(/any Brazilian bank account/);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Pix · R$ 591,36" })).toBeInTheDocument();
  });

  it("sem cotação, mostra o preço em US$ que o servidor mandou (ou o de vitrine)", () => {
    const { unmount } = renderWithQuery(
      <PixPayModal
        open
        quoteBrlCents={null}
        amountUsdCents={10000}
        periodDays={30}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Pay with Pix" })).toHaveTextContent(
      "US$ 100 in BRL · 30 days of Pro",
    );
    unmount();

    renderWithQuery(
      <PixPayModal open quoteBrlCents={null} periodDays={30} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("dialog", { name: "Pay with Pix" })).toHaveTextContent(
      "US$ 100 in BRL · 30 days of Pro",
    );
  });

  it("exibe QR, copia e cola e a cotação travada", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    createPix.mockResolvedValue(PENDING);
    open();
    await generate(user);

    expect(createPix).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("img", { name: "Pix QR code" })).toHaveAttribute(
      "src",
      PENDING.qrImage,
    );
    expect(screen.getByLabelText("Pix copy and paste")).toHaveValue(PENDING.qrCopyPaste);
    expect(screen.getByText(/US\$ 100 at R\$ 5\.9136/)).toBeInTheDocument();
    expect(screen.getByText("Waiting for payment…")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith(PENDING.qrCopyPaste);
    expect(toast.success).toHaveBeenCalledWith("Pix code copied");
  });

  it("QR ainda sendo gerado: skeleton e consulta rápida até ele sair", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    createPix.mockResolvedValue({ ...PENDING, qrCopyPaste: undefined, qrImage: undefined });
    getPix.mockResolvedValue(PENDING);
    open();
    await generate(user);

    expect(await screen.findByRole("status")).toHaveTextContent("Generating QR code");
    expect(screen.queryByRole("img", { name: "Pix QR code" })).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(await screen.findByRole("img", { name: "Pix QR code" })).toBeInTheDocument();
    expect(getPix).toHaveBeenCalledWith("pix_1");
  });

  it("consulta o status até confirmar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    createPix.mockResolvedValue(PENDING);
    getPix.mockResolvedValue({
      ...PENDING,
      status: "CONFIRMED",
      qrCopyPaste: null,
      qrImage: null,
      confirmedAt: "2026-10-21T12:00:00.000Z",
    });
    open();
    await generate(user);
    await screen.findByText("Waiting for payment…");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(await screen.findByText("Payment received")).toBeInTheDocument();
    expect(screen.getByText("30 days of Pro added.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(getPix).toHaveBeenCalledWith("pix_1");
  });

  it("QR vencido: 'Start again' volta ao início", async () => {
    const user = userEvent.setup();
    createPix.mockResolvedValue({ ...PENDING, status: "EXPIRED", qrCopyPaste: null, qrImage: null });
    open();
    await generate(user);

    expect(await screen.findByText("This QR code expired")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start again" }));
    expect(screen.getByRole("button", { name: /Generate Pix/ })).toBeInTheDocument();
  });

  it("erro na criação vira toast e mantém o botão", async () => {
    const user = userEvent.setup();
    createPix.mockRejectedValue(new Error("Pix is temporarily unavailable."));
    open();
    await generate(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Generate Pix/ })).toBeInTheDocument();
  });

  it("Esc fecha", async () => {
    const user = userEvent.setup();
    const onClose = open();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
