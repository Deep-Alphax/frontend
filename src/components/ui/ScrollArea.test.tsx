import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

import { ScrollArea } from "./ScrollArea";

const root = (c: HTMLElement) =>
  c.querySelector<HTMLElement>('[data-slot="scroll-area"]')!;

describe("ScrollArea", () => {
  it("não grava `position` inline — a classe (fixed/absolute) decide", () => {
    // O Radix põe `position: relative` inline na raiz; inline vence classe e o
    // modal de afiliados (`fixed inset-0`) virou uma caixa solta por isso.
    const { container } = render(
      <ScrollArea className="fixed inset-0">conteúdo</ScrollArea>,
    );
    expect(root(container).style.position).toBe("");
    expect(root(container).className).toMatch(/\bfixed\b/);
    expect(root(container).className).not.toMatch(/\brelative\b/);
  });

  it("sem classe de posição, fica `relative` (via classe) para ancorar a barra", () => {
    const { container } = render(<ScrollArea>conteúdo</ScrollArea>);
    expect(root(container).className).toMatch(/\brelative\b/);
  });

  it("preserva o style passado por quem usa (e as variáveis do Radix)", () => {
    const { container } = render(
      <ScrollArea style={{ height: 120 }}>conteúdo</ScrollArea>,
    );
    expect(root(container).style.height).toBe("120px");
    expect(
      root(container).style.getPropertyValue("--radix-scroll-area-corner-width"),
    ).not.toBe("");
  });

  it("viewportRef aponta para o elemento que rola, com o viewportClassName", () => {
    let vp: HTMLDivElement | null = null;
    render(
      <ScrollArea
        viewportRef={(el) => {
          vp = el;
        }}
        viewportClassName="max-h-40"
      >
        conteúdo
      </ScrollArea>,
    );
    expect(vp).not.toBeNull();
    expect(vp!.getAttribute("data-slot")).toBe("scroll-area-viewport");
    expect(vp!.className).toMatch(/\bmax-h-40\b/);
  });
});
