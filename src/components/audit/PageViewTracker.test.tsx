import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { PageViewTracker } from "./PageViewTracker";
import { sendPageView } from "@/lib/api/audit";
import { useSession } from "@/lib/auth/useSession";

const nav = vi.hoisted(() => ({ pathname: "/radar" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/api/audit", () => ({ sendPageView: vi.fn() }));
vi.mock("@/lib/auth/useSession");

const send = vi.mocked(sendPageView);

function session(isAuthenticated: boolean) {
  vi.mocked(useSession).mockReturnValue({
    profile: undefined,
    isAuthenticated,
    isLoading: false,
  });
}

describe("PageViewTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.pathname = "/radar";
    send.mockResolvedValue(undefined);
  });

  it("logado: registra a página aberta, uma vez", async () => {
    session(true);
    render(<PageViewTracker />);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith("/radar");
  });

  it("deslogado: não registra nada", async () => {
    session(false);
    render(<PageViewTracker />);
    await new Promise((r) => setTimeout(r, 10));
    expect(send).not.toHaveBeenCalled();
  });

  it("re-render no mesmo path não repete; mudar de página registra a nova", async () => {
    session(true);
    const { rerender } = render(<PageViewTracker />);
    rerender(<PageViewTracker />);
    rerender(<PageViewTracker />);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    nav.pathname = "/plans";
    rerender(<PageViewTracker />);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send).toHaveBeenLastCalledWith("/plans");
  });

  it("registra quando a sessão termina de carregar (deslogado → logado)", async () => {
    session(false);
    const { rerender } = render(<PageViewTracker />);
    expect(send).not.toHaveBeenCalled();
    session(true);
    rerender(<PageViewTracker />);
    await waitFor(() => expect(send).toHaveBeenCalledWith("/radar"));
  });

  it("falha no envio é engolida: não quebra a página", async () => {
    session(true);
    send.mockRejectedValue(new Error("network down"));
    const onError = vi.fn();
    window.addEventListener("unhandledrejection", onError);
    const { container } = render(<PageViewTracker />);
    await waitFor(() => expect(send).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    window.removeEventListener("unhandledrejection", onError);
    expect(onError).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe("");
  });
});
