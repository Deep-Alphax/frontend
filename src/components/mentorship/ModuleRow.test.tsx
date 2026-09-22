import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { ModuleRow } from "./ModuleRow";
import type { MentorshipLesson, MentorshipModule } from "@/lib/api/mentorship";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

/*
 * A esteira rola dentro do `ScrollArea`: quem mede (`clientWidth/scrollWidth`)
 * e quem rola (`scrollBy`) tem que ser o VIEWPORT, não o Root nem a faixa de
 * cards. Se o ref apontar para o elemento errado, as setas ficam mortas.
 */

function lesson(i: number): MentorshipLesson {
  return {
    id: `l${i}`,
    title: `Lesson ${i}`,
    description: "",
    episode: i,
    durationSec: 600,
    coverUrl: "/mentorship/x.webp",
    videoUrl: "",
    moduleId: "m1",
    moduleTitle: "Module",
    positionSec: 0,
    completed: false,
    percent: 0,
    materials: [],
  };
}

const MODULE: MentorshipModule = {
  id: "m1",
  slug: "mod",
  title: "Module",
  subtitle: "",
  label: "",
  coverUrl: "",
  accent: "GREEN" as MentorshipModule["accent"],
  lessonCount: 6,
  totalDurationSec: 3600,
  completedCount: 0,
  percent: 0,
  lessons: Array.from({ length: 6 }, (_, i) => lesson(i + 1)),
};

/** jsdom não faz layout: define as medidas do viewport na mão. */
function size(el: HTMLElement, clientWidth: number, scrollWidth: number) {
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
}

function viewport(container: HTMLElement) {
  const el = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
  if (!el) throw new Error("viewport do ScrollArea não encontrado");
  return el;
}

describe("ModuleRow — esteira dentro do ScrollArea", () => {
  it("as cards ficam dentro do viewport do ScrollArea", () => {
    const { container } = render(<ModuleRow module={MODULE} />);
    expect(viewport(container)).toContainElement(screen.getByText("Lesson 1"));
  });

  it("setas medem o VIEWPORT: no início só 'próximo' liga; no fim só 'anterior'", () => {
    const { container } = render(<ModuleRow module={MODULE} />);
    const vp = viewport(container);
    size(vp, 612, 1836); // cabem 2 cards, transborda

    vp.scrollLeft = 0;
    act(() => {
      fireEvent.scroll(vp);
    });
    expect(screen.getByRole("button", { name: /Previous lessons/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /More lessons/ })).toBeEnabled();

    vp.scrollLeft = 1836 - 612;
    act(() => {
      fireEvent.scroll(vp);
    });
    expect(screen.getByRole("button", { name: /Previous lessons/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /More lessons/ })).toBeDisabled();
  });

  it("'próximo' rola o VIEWPORT por cards inteiros", () => {
    const { container } = render(<ModuleRow module={MODULE} />);
    const vp = viewport(container);
    size(vp, 612, 1836);
    const scrollBy = vi.fn();
    vp.scrollBy = scrollBy as unknown as typeof vp.scrollBy;
    act(() => {
      fireEvent.scroll(vp);
    });

    fireEvent.click(screen.getByRole("button", { name: /More lessons/ }));
    // 612 / 306 = 2 cards inteiros por clique.
    expect(scrollBy).toHaveBeenCalledWith({ left: 612, behavior: "smooth" });
  });
});
