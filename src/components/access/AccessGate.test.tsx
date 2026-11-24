import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AccessGate } from "./AccessGate";
import type { MyAccess } from "@/lib/api/access";
import { hasSessionHint } from "@/lib/auth/sessionHint";
import { useSession } from "@/lib/auth/useSession";
import { usePlan, type PlanState } from "@/lib/billing/usePlan";

vi.mock("@/lib/auth/useSession");
vi.mock("@/lib/auth/sessionHint", () => ({ hasSessionHint: vi.fn() }));
vi.mock("@/lib/billing/usePlan");
// A moldura (Topbar/Footer) puxa sessão, carteira e navegação — fora do que o gate decide.
vi.mock("@/components/home/Topbar", () => ({ Topbar: () => <header data-testid="topbar" /> }));
vi.mock("@/components/home/Footer", () => ({ Footer: () => <footer /> }));

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

function setSession(state: "anonymous" | "loading" | "authenticated") {
  vi.mocked(hasSessionHint).mockReturnValue(state !== "anonymous");
  vi.mocked(useSession).mockReturnValue({
    profile: state === "authenticated" ? ({ id: "u1", role: "USER" } as never) : undefined,
    isAuthenticated: state === "authenticated",
    isLoading: state === "loading",
  });
}

function setAccess(access: MyAccess | undefined, over: Partial<PlanState> = {}) {
  vi.mocked(usePlan).mockReturnValue({
    plan: "FREE",
    isPro: false,
    isLoading: access === undefined,
    isError: false,
    access,
    isRestricted: access?.restricted ?? false,
    ...over,
  });
}

const ELIXIR_FREE: MyAccess = { role: "ELIXIR_ALPHA", restricted: true, mentorship: true };
const PLAIN_FREE: MyAccess = { role: "USER", restricted: false, mentorship: false };
const PRO: MyAccess = { role: "USER", restricted: false, mentorship: true };

const Screen = () => <p>Protected screen</p>;

describe("AccessGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restrito numa tela que custa: card do Elixir Alpha, e a tela nem monta", () => {
    setSession("authenticated");
    setAccess(ELIXIR_FREE);
    render(
      <AccessGate requires="unrestricted">
        <Screen />
      </AccessGate>,
    );

    expect(
      screen.getByRole("heading", { name: "This area isn't included in your Elixir Alpha access" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Mentorship" })).toHaveAttribute("href", "/mentorship");
    expect(screen.getByRole("link", { name: "Become a Pro" })).toHaveAttribute("href", "/plans");
    // Moldura do app em volta do card.
    expect(screen.getByTestId("topbar")).toBeInTheDocument();
  });

  it("Home do restrito: vai para a Mentoria em vez de mostrar o card", () => {
    setSession("authenticated");
    setAccess(ELIXIR_FREE);
    render(
      <AccessGate requires="unrestricted" frame="none" redirectRestrictedTo="/mentorship">
        <Screen />
      </AccessGate>,
    );

    expect(replace).toHaveBeenCalledWith("/mentorship");
    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("restrito na Mentoria: liberado (o cargo inclui a Mentoria)", () => {
    setSession("authenticated");
    setAccess(ELIXIR_FREE);
    render(
      <AccessGate requires="mentorship">
        <Screen />
      </AccessGate>,
    );
    expect(screen.getByText("Protected screen")).toBeInTheDocument();
  });

  it("FREE comum na Mentoria: upsell do Pro, sem montar a tela", () => {
    setSession("authenticated");
    setAccess(PLAIN_FREE);
    render(
      <AccessGate requires="mentorship">
        <Screen />
      </AccessGate>,
    );

    expect(screen.getByRole("heading", { name: "Mentorship is part of Pro" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Become a Pro" })).toHaveAttribute("href", "/plans");
    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();
  });

  it("PRO passa nos dois gates", () => {
    setSession("authenticated");
    setAccess(PRO, { plan: "PRO", isPro: true });
    const { rerender } = render(
      <AccessGate requires="mentorship">
        <Screen />
      </AccessGate>,
    );
    expect(screen.getByText("Protected screen")).toBeInTheDocument();
    rerender(
      <AccessGate requires="unrestricted">
        <Screen />
      </AccessGate>,
    );
    expect(screen.getByText("Protected screen")).toBeInTheDocument();
  });

  it("sessão ou acesso carregando: skeleton animado, nada da tela", () => {
    setSession("loading");
    setAccess(undefined, { isLoading: false });
    const { rerender } = render(
      <AccessGate requires="unrestricted">
        <Screen />
      </AccessGate>,
    );
    const status = screen.getByRole("status");
    expect(status.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();

    setSession("authenticated");
    setAccess(undefined);
    rerender(
      <AccessGate requires="mentorship">
        <Screen />
      </AccessGate>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Protected screen")).not.toBeInTheDocument();
  });

  it("deslogado passa direto (a Home é pública)", () => {
    setSession("anonymous");
    setAccess(undefined, { isLoading: false });
    render(
      <AccessGate requires="unrestricted" frame="none" redirectRestrictedTo="/mentorship">
        <Screen />
      </AccessGate>,
    );
    expect(screen.getByText("Protected screen")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("falha ao ler o acesso: não tranca o app (o backend é a autoridade)", () => {
    setSession("authenticated");
    setAccess(undefined, { isLoading: false, isError: true });
    render(
      <AccessGate requires="mentorship">
        <Screen />
      </AccessGate>,
    );
    expect(screen.getByText("Protected screen")).toBeInTheDocument();
  });
});
