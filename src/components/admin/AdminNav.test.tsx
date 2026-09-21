import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminNav } from "./AdminNav";

const pathname = vi.hoisted(() => ({ current: "/admin/mentorship" }));
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

describe("AdminNav", () => {
  beforeEach(() => {
    pathname.current = "/admin/mentorship";
  });

  it("dá acesso às quatro telas de admin e ao caminho de volta", () => {
    render(<AdminNav />);

    for (const label of ["Mentorship", "KOLs", "Discord feed", "Affiliates"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /Back to app/ })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("marca a tela atual", () => {
    pathname.current = "/admin/kols";
    render(<AdminNav />);

    expect(screen.getByRole("link", { name: "KOLs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Mentorship" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("sub-rota mantém o item pai marcado", () => {
    // Ex.: /admin/kols/:id. Igualdade estrita deixaria a navegação sem nenhum
    // item ativo no momento em que o admin está mais fundo.
    pathname.current = "/admin/kols/abc123";
    render(<AdminNav />);

    expect(screen.getByRole("link", { name: "KOLs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
