import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DeepRankingScreen } from "./DeepRankingScreen";
import * as ranking from "@/lib/api/ranking";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/api/ranking", async (importOriginal) => {
  const actual = await importOriginal<typeof ranking>();
  return { ...actual, getRankingOverview: vi.fn(), getRankingStandings: vi.fn() };
});
vi.mock("@/components/home/Topbar", () => ({ Topbar: () => <header /> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/wallet-reader/ranking" }));

const getOverview = vi.mocked(ranking.getRankingOverview);
const getStandings = vi.mocked(ranking.getRankingStandings);

const SEASON: ranking.RankingSeason = {
  id: "s1",
  name: "Season 1",
  startsAt: new Date(Date.now() - 86_400_000).toISOString(),
  endsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  status: "active",
};

function row(position: number, over: Partial<ranking.RankingRow> = {}): ranking.RankingRow {
  return {
    position,
    change: null,
    kol: { id: `k${position}`, name: `kol${position}`, handle: `kol${position}`, x: null, relevance: 40 },
    points: 1000 - position,
    calls: 10,
    accuracy: 50,
    prize: null,
    ...over,
  };
}

describe("DeepRankingScreen", () => {
  beforeEach(() => {
    getOverview.mockReset();
    getStandings.mockReset();
  });

  it("pódio, contador e tabela a partir da 4ª posição", async () => {
    getOverview.mockResolvedValue({
      season: SEASON,
      podium: [
        row(1, { kol: { id: "a", name: "reefcalls", handle: "reefcalls", x: "reefcalls", relevance: 95 }, prize: 10000, change: 4 }),
        row(2, { prize: 5000, change: -3 }),
        row(3),
      ],
      total: 15,
      updatedAt: null,
    });
    getStandings.mockImplementation(async ({ offset, limit }) => ({
      rows: Array.from({ length: Math.min(limit, 15 - offset) }, (_, i) => row(offset + i + 1)),
      total: 15,
    }));

    renderWithQuery(<DeepRankingScreen />);

    const podium = await screen.findByRole("list", { name: "Podium" });
    expect(within(podium).getByText("reefcalls")).toBeInTheDocument();
    expect(within(podium).getByText("$10,000")).toBeInTheDocument();
    expect(within(podium).getByRole("link", { name: "reefcalls on X" })).toHaveAttribute(
      "href",
      "https://x.com/reefcalls",
    );
    expect(screen.getByText("Season 1 ends in")).toBeInTheDocument();

    const table = await screen.findByRole("table", { name: "Standings" });
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(11)); // cabeçalho + 4–13
    expect(getStandings).toHaveBeenCalledWith({ offset: 3, limit: 10, q: undefined });

    await userEvent.click(screen.getByRole("button", { name: "Load 20 more" }));
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(13)); // + 14–15
    expect(getStandings).toHaveBeenLastCalledWith({ offset: 13, limit: 20, q: undefined });
    expect(screen.queryByRole("button", { name: "Load 20 more" })).not.toBeInTheDocument();
  });

  it("busca procura em todos (inclusive o pódio), sem o @", async () => {
    getOverview.mockResolvedValue({ season: SEASON, podium: [row(1)], total: 1, updatedAt: null });
    getStandings.mockResolvedValue({ rows: [], total: 0 });

    renderWithQuery(<DeepRankingScreen />);
    await userEvent.type(await screen.findByRole("searchbox", { name: /search kol/i }), "@gar");

    await waitFor(() =>
      expect(getStandings).toHaveBeenLastCalledWith({ offset: 0, limit: 10, q: "gar" }),
    );
    expect(await screen.findByText('No KOL matches "@gar".')).toBeInTheDocument();
  });

  it("sem temporada: aviso no lugar do pódio e Connect X desabilitado", async () => {
    getOverview.mockResolvedValue({ season: null, podium: [], total: 0, updatedAt: null });

    renderWithQuery(<DeepRankingScreen />);

    expect(await screen.findByText("The first season is coming")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coming soon" })).toBeDisabled();
    expect(getStandings).not.toHaveBeenCalled();
  });

  it("How it works mostra a tabela de pontos", async () => {
    getOverview.mockResolvedValue({ season: SEASON, podium: [], total: 0, updatedAt: null });
    getStandings.mockResolvedValue({ rows: [], total: 0 });

    renderWithQuery(<DeepRankingScreen />);
    await userEvent.click(screen.getByRole("button", { name: "How it works" }));

    expect(screen.getByText("10x or more")).toBeInTheDocument();
    expect(screen.getByText("+600")).toBeInTheDocument();
    expect(screen.getByText("-20")).toBeInTheDocument();
  });
});
