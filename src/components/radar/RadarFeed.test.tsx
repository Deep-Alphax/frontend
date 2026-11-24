import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { RadarFeed } from "./RadarFeed";
import { RickBotPanel } from "./RickBotPanel";
import { usePlan } from "@/lib/billing/usePlan";
import * as feedApi from "@/lib/api/feed";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/billing/usePlan");
vi.mock("@/lib/api/feed", async (importOriginal) => {
  const actual = await importOriginal<typeof feedApi>();
  return { ...actual, getFeedMessages: vi.fn() };
});

const mockPlan = vi.mocked(usePlan);

function plan(state: "FREE" | "PRO" | "loading") {
  mockPlan.mockReturnValue({
    plan: state === "PRO" ? "PRO" : "FREE",
    isPro: state === "PRO",
    isLoading: state === "loading",
    isError: false,
    access: undefined,
    isRestricted: false,
  });
}

function renderFeed(over: Partial<Parameters<typeof RadarFeed>[0]> = {}) {
  return render(
    <RadarFeed
      messages={[]}
      isLoading={false}
      isFetchingNextPage={false}
      hasMore={false}
      loadMore={() => {}}
      selectedName={null}
      newIds={new Set()}
      search=""
      onSearchChange={() => {}}
      {...over}
    />,
  );
}

const upgrade = () => screen.queryByRole("link", { name: /Upgrade to Pro/ });

describe("RadarFeed — feed vazio por plano", () => {
  beforeEach(() => vi.clearAllMocks());

  it("FREE sem capturas: explica o recorte do plano e oferece o Pro", () => {
    plan("FREE");
    renderFeed();
    expect(screen.getByText("The Free plan shows a selection of groups")).toBeInTheDocument();
    expect(screen.queryByText("No messages here")).not.toBeInTheDocument();
    expect(upgrade()).toHaveAttribute("href", "/plans");
  });

  it("FREE com um grupo selecionado cita o grupo", () => {
    plan("FREE");
    renderFeed({ selectedName: "Alpha Lounge" });
    expect(
      screen.getByText('"Alpha Lounge" has no captures available on Free right now.'),
    ).toBeInTheDocument();
  });

  it("PRO sem capturas: vazio neutro, sem oferta", () => {
    plan("PRO");
    renderFeed();
    expect(screen.getByText("No messages here")).toBeInTheDocument();
    expect(upgrade()).not.toBeInTheDocument();
  });

  it("plano ainda carregando: vazio neutro (não oferece Pro a quem talvez já seja)", () => {
    plan("loading");
    renderFeed();
    expect(screen.getByText("No messages here")).toBeInTheDocument();
    expect(upgrade()).not.toBeInTheDocument();
  });

  it("FREE buscando sem resultado: é assunto de busca, não de plano", () => {
    plan("FREE");
    renderFeed({ search: "wif" });
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(upgrade()).not.toBeInTheDocument();
  });
});

describe("RickBotPanel — vazio por plano", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(feedApi.getFeedMessages).mockResolvedValue({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    } as never);
  });

  it("FREE: explica que o Rick só aparece dos grupos Free e oferece o Pro", async () => {
    plan("FREE");
    renderWithQuery(<RickBotPanel />);
    expect(
      await screen.findByText("On Free, Rick only shows up from the groups open to Free."),
    ).toBeInTheDocument();
    expect(upgrade()).toHaveAttribute("href", "/plans");
  });

  it("PRO: vazio neutro, sem oferta", async () => {
    plan("PRO");
    renderWithQuery(<RickBotPanel />);
    expect(
      await screen.findByText("Rick Bot captures show up here in real time."),
    ).toBeInTheDocument();
    expect(upgrade()).not.toBeInTheDocument();
  });
});
