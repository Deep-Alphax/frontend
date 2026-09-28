import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { CapturedMessage } from "@/lib/api/feed";
import { ChatMessageList } from "./ChatMessageList";

// O card real puxa favoritos/personalização (contexto + queries) — fora do
// escopo: aqui importa QUANTOS cards existem no DOM, não como são desenhados.
vi.mock("@/components/radar/RadarMessageCard", () => ({
  RadarMessageCard: ({ m }: { m: CapturedMessage }) => <article data-testid="card">{m.id}</article>,
}));

const msg = (i: number): CapturedMessage => ({
  id: `m${i}`,
  monitorId: null,
  guildName: "Lair",
  channelId: "c1",
  channelName: "calls",
  authorTag: "a#1",
  authorId: null,
  matchedPattern: null,
  discordMessageId: null,
  text: `msg ${i}`,
  embed: null,
  links: [],
  sentToTelegram: false,
  telegramError: null,
  createdAt: new Date(Date.UTC(2026, 8, 28, 12) - i * 60_000).toISOString(),
});

function renderList(count: number) {
  return render(
    <ChatMessageList
      messages={Array.from({ length: count }, (_, i) => msg(i))}
      hasOlder
      isLoadingOlder={false}
      loadOlder={() => {}}
    />,
  );
}

describe("ChatMessageList — virtualização", () => {
  // jsdom não mede nada: a área visível (`offsetHeight` do contêiner rolável)
  // seria 0 e nenhum card caberia. Simula uma coluna de 800px e cards de 100px.
  let rectSpy: ReturnType<typeof vi.spyOn>;
  const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 800,
    });
    rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 100,
      right: 300,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });
  });
  afterEach(() => {
    rectSpy.mockRestore();
    if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
  });

  it("com 500 mensagens, monta só uma janela de cards", () => {
    renderList(500);
    const mounted = screen.getAllByTestId("card").length;
    expect(mounted).toBeGreaterThan(0);
    // Janela visível (~800px / 100px) + overscan dos dois lados — longe de 500.
    expect(mounted).toBeLessThan(40);
  });

  it("o contêiner tem a altura da lista INTEIRA (a rolagem e a ancoragem dependem disso)", () => {
    const { container } = renderList(500);
    const list = container.querySelector<HTMLElement>("[data-index]")!.parentElement;
    expect(parseInt(list!.style.height, 10)).toBeGreaterThanOrEqual(500 * 100);
  });

  it("poucas mensagens: todas aparecem", () => {
    renderList(3);
    expect(screen.getAllByTestId("card").map((c) => c.textContent)).toEqual(["m2", "m1", "m0"]);
  });

  it("o último card fica sem divisória (e só ele)", () => {
    const { container } = renderList(3);
    const wrappers = [...container.querySelectorAll("[data-index]")];
    const last = wrappers.find((w) => w.getAttribute("data-index") === "2")!;
    expect(last.className).toContain("[&>article]:border-b-0");
    expect(wrappers.filter((w) => w.className.includes("border-b-0"))).toHaveLength(1);
  });
});
