import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { Topbar } from "./Topbar";
import type { MyAccess } from "@/lib/api/access";
import { useAccountEvents } from "@/lib/alerts/useAccountEvents";
import { useSession } from "@/lib/auth/useSession";
import { usePlan } from "@/lib/billing/usePlan";

vi.mock("@/lib/auth/useSession");
vi.mock("@/lib/billing/usePlan");
vi.mock("@/lib/alerts/useAccountEvents", () => ({ useAccountEvents: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/mentorship" }));
// Os widgets do header têm queries próprias — aqui só importa QUAIS aparecem.
vi.mock("@/components/alerts/NotificationBell", () => ({
  NotificationBell: () => <button type="button">Notifications</button>,
}));
vi.mock("@/components/home/WalletChip", () => ({ WalletChip: () => <span>Wallets</span> }));
vi.mock("@/components/deposits/DepositButton", () => ({
  DepositButton: () => <button type="button">Deposit</button>,
}));
vi.mock("@/components/home/AccountMenu", () => ({
  AccountMenu: ({ restricted }: { restricted?: boolean }) => (
    <span>{restricted ? "Account (restricted)" : "Account"}</span>
  ),
}));
vi.mock("@/components/home/BecomeProButton", () => ({ BecomeProButton: () => null }));

function setup(access: MyAccess | undefined, { loading = false } = {}) {
  vi.mocked(useSession).mockReturnValue({
    profile: { id: "u1", email: "ana@example.com", firstName: "Ana", role: access?.role ?? "USER" } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  vi.mocked(usePlan).mockReturnValue({
    plan: "FREE",
    isPro: false,
    isLoading: loading,
    isError: false,
    access,
    isRestricted: access?.restricted ?? false,
  });
}

function navLabels(): string[] {
  const nav = screen.getByRole("navigation");
  return within(nav)
    .getAllByRole("link")
    .map((a) => a.textContent ?? "");
}

describe("Topbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restrito (Elixir Alpha FREE): só Mentoria e KOLs, logo para /mentorship", () => {
    setup({ role: "ELIXIR_ALPHA", restricted: true, mentorship: true });
    render(<Topbar />);

    expect(navLabels()).toEqual(["Mentorship", "KOLs"]);
    expect(screen.getByRole("link", { name: "Deep Alpha — home" })).toHaveAttribute(
      "href",
      "/mentorship",
    );
  });

  it("restrito: sem sininho, carteiras e depósito (dariam 403); socket segue ligado", () => {
    setup({ role: "ELIXIR_ALPHA", restricted: true, mentorship: true });
    render(<Topbar />);

    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByText("Wallets")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deposit" })).not.toBeInTheDocument();
    expect(screen.getByText("Account (restricted)")).toBeInTheDocument();
    // `plan:update` continua chegando (sem o sininho, que é quem o montava).
    expect(useAccountEvents).toHaveBeenCalledWith(true);
  });

  it("Elixir Alpha que virou PRO (não restrito): navegação completa", () => {
    setup({ role: "ELIXIR_ALPHA", restricted: false, mentorship: true });
    render(<Topbar />);

    expect(navLabels()).toEqual([
      "Mentorship",
      "Radar",
      "Tracker",
      "KOLs",
      "Copy Trade",
      "My profile",
    ]);
    expect(screen.getByRole("link", { name: "Deep Alpha — home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByText("Wallets")).toBeInTheDocument();
  });

  it("acesso carregando: skeleton no lugar dos widgets (nada que chame a API)", () => {
    setup(undefined, { loading: true });
    render(<Topbar />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByText("Wallets")).not.toBeInTheDocument();
  });
});
