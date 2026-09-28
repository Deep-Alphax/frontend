import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import * as feedApi from "@/lib/api/feed";
import type { CapturedMessage, FeedPage } from "@/lib/api/feed";
import { makeTestQueryClient } from "@/test/queryWrapper";
import { feedScope, useRadarFeed, type SourceSelection } from "./useRadarFeed";

vi.mock("@/lib/api/feed", async (importOriginal) => {
  const actual = await importOriginal<typeof feedApi>();
  return { ...actual, getFeedMessages: vi.fn(), getFeedGroups: vi.fn() };
});

/** Socket de mentira: guarda o handler de `feed:new` para o teste disparar. */
const handlers: Record<string, (m: CapturedMessage) => void> = {};
vi.mock("@/lib/realtime/socket", () => ({
  getSocket: () => ({
    on: (ev: string, fn: (m: CapturedMessage) => void) => (handlers[ev] = fn),
    off: vi.fn(),
    connect: vi.fn(),
  }),
}));

const msg = (id: string, over: Partial<CapturedMessage> = {}): CapturedMessage => ({
  id,
  monitorId: "m1",
  guildName: "Lair",
  channelId: "c1",
  channelName: "calls",
  authorTag: "a#1",
  authorId: null,
  matchedPattern: null,
  discordMessageId: null,
  text: id,
  embed: null,
  links: [],
  sentToTelegram: false,
  telegramError: null,
  createdAt: "2026-09-28T12:00:00.000Z",
  ...over,
});

const page = (items: CapturedMessage[], over: Partial<FeedPage> = {}): FeedPage => ({
  items,
  page: 1,
  limit: 20,
  hasMore: false,
  ...over,
});

function setup(selection: SourceSelection = null) {
  const client = makeTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ sel }) => useRadarFeed(sel, ""), {
    wrapper,
    initialProps: { sel: selection },
  });
}

describe("feedScope", () => {
  it("todas as fontes: sem filtro", () => {
    expect(feedScope(null)).toEqual({ key: null });
  });

  it("servidor vai para o backend como guildName", () => {
    expect(feedScope({ kind: "guild", guild: "Lair" })).toEqual({
      key: "g:Lair",
      guildName: "Lair",
    });
  });

  it("canal vai como channelId", () => {
    expect(feedScope({ kind: "channel", channelId: "c1" })).toEqual({
      key: "c:c1",
      channelId: "c1",
    });
  });

  it("grupo sem servidor fica no pool (não há valor para a query)", () => {
    expect(feedScope({ kind: "guild", guild: null })).toEqual({ key: null });
  });

  it("servidor e canal com o mesmo texto não colidem no cache", () => {
    expect(feedScope({ kind: "guild", guild: "x" }).key).not.toBe(
      feedScope({ kind: "channel", channelId: "x" }).key,
    );
  });
});

describe("nextFeedPage", () => {
  it("devolve o cursor quando há mais", () => {
    expect(feedApi.nextFeedPage(page([], { hasMore: true, nextCursor: "c1" }))).toBe("c1");
  });

  it("para na última página (sem hasMore ou sem cursor)", () => {
    expect(feedApi.nextFeedPage(page([], { hasMore: false }))).toBeUndefined();
    expect(feedApi.nextFeedPage(page([], { hasMore: true }))).toBeUndefined();
  });
});

describe("useRadarFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(feedApi.getFeedGroups).mockResolvedValue([]);
    vi.mocked(feedApi.getFeedMessages).mockResolvedValue(page([msg("m1")]));
  });

  it("pede a página SEM total (sem COUNT no servidor)", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(feedApi.getFeedMessages).toHaveBeenCalledWith(
      expect.objectContaining({ before: undefined, limit: 20, withTotal: false }),
    );
  });

  it("servidor selecionado é filtrado no backend", async () => {
    setup({ kind: "guild", guild: "Lair" });
    await waitFor(() =>
      expect(feedApi.getFeedMessages).toHaveBeenCalledWith(
        expect.objectContaining({ guildName: "Lair", channelId: undefined }),
      ),
    );
  });

  it("próxima página pede pelo cursor da anterior", async () => {
    vi.mocked(feedApi.getFeedMessages)
      .mockResolvedValueOnce(page([msg("m1")], { hasMore: true, nextCursor: "cur-m1" }))
      .mockResolvedValueOnce(page([msg("m2")], { hasMore: false }));
    const { result } = setup();
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.messages.map((m) => m.id)).toEqual(["m1", "m2"]));
    expect(feedApi.getFeedMessages).toHaveBeenLastCalledWith(
      expect.objectContaining({ before: "cur-m1" }),
    );
    expect(result.current.hasMore).toBe(false);
  });

  it("tempo real entra no feed do servidor aberto, sem total para somar", async () => {
    const { result } = setup({ kind: "guild", guild: "Lair" });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => handlers["feed:new"](msg("rt1")));
    expect(result.current.messages.map((m) => m.id)).toEqual(["rt1", "m1"]);
    expect(result.current.newIds.has("rt1")).toBe(true);
  });

  it("tempo real de OUTRO servidor não entra no feed do servidor aberto", async () => {
    const { result } = setup({ kind: "guild", guild: "Lair" });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => handlers["feed:new"](msg("rt2", { guildName: "Den", channelId: "c9" })));
    expect(result.current.messages.map((m) => m.id)).toEqual(["m1"]);
  });
});
