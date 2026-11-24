import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import toast from "react-hot-toast";

import { InviteRedeemer } from "./InviteRedeemer";
import { PLAN_KEY } from "@/lib/api/billing";
import { useSession } from "@/lib/auth/useSession";
import { API_URL } from "@/lib/env";
import { captureInviteFromUrl, storedInvite } from "@/lib/invite";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/auth/useSession");
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const REDEEM_URL = `${API_URL}/api/v1/access/invites/redeem`;

const redeemed: string[] = [];
const server = setupServer(
  http.post(REDEEM_URL, async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    redeemed.push(code);
    if (code === "ELIXIR1") return HttpResponse.json({ role: "ELIXIR_ALPHA", changed: true });
    if (code === "OLD") {
      return HttpResponse.json({ message: "This invite has expired." }, { status: 410 });
    }
    if (code === "BUSY") {
      return HttpResponse.json({ message: "Too many requests" }, { status: 429 });
    }
    return HttpResponse.json({ message: "Invalid invite code." }, { status: 404 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function setSession(role: string | null) {
  vi.mocked(useSession).mockReturnValue({
    profile: role ? ({ id: "u1", email: "ana@example.com", role } as never) : undefined,
    isAuthenticated: role !== null,
    isLoading: false,
  });
}

const DIALOG = { name: "You've been invited to Elixir Alpha" };

describe("InviteRedeemer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    redeemed.length = 0;
  });

  it("logado com convite guardado: pergunta antes, e só resgata no Accept", async () => {
    const user = userEvent.setup();
    captureInviteFromUrl("?invite=elixir1");
    setSession("USER");
    const { client } = renderWithQuery(<InviteRedeemer />);
    const invalidate = vi.spyOn(client, "invalidateQueries");

    expect(await screen.findByRole("dialog", DIALOG)).toBeInTheDocument();
    // Abrir o diálogo não resgata nada sozinho.
    expect(redeemed).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/mentorship"));
    expect(redeemed).toEqual(["ELIXIR1"]);
    expect(storedInvite()).toBeUndefined();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PLAN_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["profile"] });
    expect(toast.success).toHaveBeenCalledWith(
      "Welcome to Elixir Alpha! Mentorship is now unlocked.",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("'Not now' descarta o código sem chamar a API", async () => {
    const user = userEvent.setup();
    captureInviteFromUrl("?invite=ELIXIR1");
    setSession("USER");
    renderWithQuery(<InviteRedeemer />);

    await user.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedInvite()).toBeUndefined();
    expect(redeemed).toEqual([]);
  });

  it("código morto (410): limpa e mostra a mensagem do backend", async () => {
    const user = userEvent.setup();
    captureInviteFromUrl("?invite=OLD");
    setSession("USER");
    renderWithQuery(<InviteRedeemer />);

    await user.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("This invite has expired."));
    expect(storedInvite()).toBeUndefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("429 é transitório: o código fica guardado", async () => {
    const user = userEvent.setup();
    captureInviteFromUrl("?invite=BUSY");
    setSession("USER");
    renderWithQuery(<InviteRedeemer />);

    await user.click(await screen.findByRole("button", { name: "Accept" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(storedInvite()).toBe("BUSY");
    expect(screen.getByRole("dialog", DIALOG)).toBeInTheDocument();
  });

  it("já é Elixir Alpha: limpa em silêncio, sem diálogo nem chamada", async () => {
    captureInviteFromUrl("?invite=ELIXIR1");
    setSession("ELIXIR_ALPHA");
    renderWithQuery(<InviteRedeemer />);

    await waitFor(() => expect(storedInvite()).toBeUndefined());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(redeemed).toEqual([]);
  });

  it("deslogado: guarda o código para depois e não pergunta nada", async () => {
    captureInviteFromUrl("?invite=ELIXIR1");
    setSession(null);
    renderWithQuery(<InviteRedeemer />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storedInvite()).toBe("ELIXIR1");
  });
});
