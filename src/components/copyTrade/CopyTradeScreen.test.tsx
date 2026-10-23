import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CopyTradeScreen } from "./CopyTradeScreen";
import * as copyTrade from "@/lib/api/copyTrade";
import * as devSnipe from "@/lib/api/devSnipe";
import * as tracker from "@/lib/api/tracker";
import { renderWithQuery } from "@/test/queryWrapper";
import { DEFAULT_COPY_CONFIG } from "@/lib/copyTrade/config";

vi.mock("@/lib/api/copyTrade", async (importOriginal) => {
  const actual = await importOriginal<typeof copyTrade>();
  return {
    ...actual,
    getCopyTradeHome: vi.fn(),
    getCopyKols: vi.fn(),
    getCopyKol: vi.fn(),
    getCopyOverview: vi.fn(),
    getCopyFeed: vi.fn(),
    getKolCopy: vi.fn(),
    getCopiers: vi.fn(),
    createCopy: vi.fn(),
    resolveCopyAddress: vi.fn(),
    updateCopy: vi.fn(),
    copyAction: vi.fn(),
  };
});
vi.mock("@/lib/api/devSnipe", async (importOriginal) => {
  const actual = await importOriginal<typeof devSnipe>();
  return { ...actual, getSnipeOverview: vi.fn() };
});
// A aba ativa vem de `?type=` — aqui sempre a URL do jsdom (Wallet Copy).
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("@/lib/api/tracker", async (importOriginal) => {
  const actual = await importOriginal<typeof tracker>();
  return { ...actual, getTrackerFeed: vi.fn() };
});
const plan = vi.hoisted(() => ({ isPro: true }));
vi.mock("@/lib/billing/usePlan", () => ({
  usePlan: () => ({ plan: plan.isPro ? "PRO" : "FREE", isPro: plan.isPro, isLoading: false }),
}));
vi.mock("@/components/home/Topbar", () => ({ Topbar: () => <header /> }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const getHome = vi.mocked(copyTrade.getCopyTradeHome);
const getKols = vi.mocked(copyTrade.getCopyKols);
const getKol = vi.mocked(copyTrade.getCopyKol);
const getFeed = vi.mocked(tracker.getTrackerFeed);
const getOverview = vi.mocked(copyTrade.getCopyOverview);
const getCopyFeed = vi.mocked(copyTrade.getCopyFeed);
const getKolCopy = vi.mocked(copyTrade.getKolCopy);
const getCopiers = vi.mocked(copyTrade.getCopiers);
const createCopy = vi.mocked(copyTrade.createCopy);
const resolveAddress = vi.mocked(copyTrade.resolveCopyAddress);
const WALLET = "7xKXq2Nf8wTzR1bV9mYcA3dLpE6sJ4hU9fQ2";

const EMPTY_OVERVIEW: copyTrade.CopyOverview = {
  mode: "shadow",
  w1: { address: "W1addr111111111111111111111111111", balanceSol: 5, createdAt: new Date().toISOString() },
  summary: { resultSol: 0, resultPct: null, todaySol: 0, spark: [] },
  active: [],
  history: [],
};

const copyView = (p: Partial<copyTrade.CopyView> = {}): copyTrade.CopyView => ({
  id: "c1",
  kol: { id: "reefcalls", label: "@reefcalls", relevance: 95, avatarUrl: null },
  status: "ACTIVE",
  stopReason: null,
  statusAt: new Date().toISOString(),
  createdAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
  endedAt: null,
  config: structuredClone(DEFAULT_COPY_CONFIG),
  resultSol: 12.4,
  resultPct: 38,
  todaySol: 1.9,
  trades: 38,
  open: 3,
  ...p,
});

const stats = (p: Partial<copyTrade.CopyKolStats> = {}): copyTrade.CopyKolStats => ({
  hitRate: 58,
  resolved: 50,
  pnlSol: 312,
  pnl24hSol: 41,
  avgBetSol: 3.6,
  avgHoldMs: 125 * 60_000,
  buys: 100,
  sells: 28,
  tokens: 24,
  ...p,
});

const kol = (id: string, p: Partial<copyTrade.CopyKol> = {}): copyTrade.CopyKol => ({
  id,
  name: id,
  handle: id,
  relevance: 95,
  types: ["sniper"],
  avatarUrl: null,
  stats: stats(),
  copiers: 0,
  ...p,
});

const HOME: copyTrade.CopyTradeHome = {
  forYou: [kol("reefcalls"), kol("nautilo", { relevance: 45, stats: stats({ pnlSol: 97, hitRate: 64 }) })],
  trending: [kol("reefcalls")],
  topHit: [kol("nautilo", { relevance: 45 })],
  newInRanking: [],
  updatedAt: new Date().toISOString(),
};

describe("CopyTradeScreen", () => {
  beforeEach(() => {
    plan.isPro = true;
    vi.mocked(devSnipe.getSnipeOverview).mockReset().mockResolvedValue({ mode: "shadow", w1: null, waiting: [], fired: [] });
    getOverview.mockReset().mockResolvedValue(EMPTY_OVERVIEW);
    getCopyFeed.mockReset().mockResolvedValue({ items: [], total: 0, page: 1 });
    getKolCopy.mockReset().mockResolvedValue({ mode: "shadow", copy: null, events: [] });
    getCopiers.mockReset();
    createCopy.mockReset();
    getHome.mockReset().mockResolvedValue(HOME);
    getKols.mockReset().mockResolvedValue({ items: [kol("batial")], total: 1 });
    getKol.mockReset().mockResolvedValue({
      kol: kol("reefcalls"),
      series: Array.from({ length: 30 }, (_, i) => i * 10),
      tokenSummary: { total: 0, profitable: 0, bestMultiple: null, open: 0 },
      tokens: [],
      updatedAt: new Date().toISOString(),
    });
    getFeed.mockReset().mockResolvedValue({
      items: [
        {
          id: "c1",
          status: "bought_before",
          kol: { id: "reefcalls", name: "reefcalls", handle: "reefcalls", relevance: 95 },
          token: { chain: "SOLANA", mint: "Mint1111111111", symbol: "KEKO", name: null, imageUrl: null, mcUsd: null },
          call: null,
          trades: [
            {
              id: "t1",
              side: "BUY",
              quoteSymbol: "SOL",
              quoteAmount: 3.5,
              usdValue: 500,
              mcUsd: 2_400_000,
              at: new Date().toISOString(),
              relation: null,
            },
          ],
          pnlUsd: null,
          strike: null,
          lastActivityAt: new Date().toISOString(),
        },
      ],
      nextCursor: null,
    });
  });

  it("primeiro acesso: criar copy, passo a passo e as seções", async () => {
    renderWithQuery(<CopyTradeScreen />);

    expect(screen.getByRole("heading", { name: "Create copy" })).toBeInTheDocument();
    // O passo a passo aparece quando o overview confirma que não há copies.
    expect(await screen.findByText("Pick a wallet")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /wallet copy/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /dev snipe/i })).toHaveAttribute("aria-selected", "false");

    const card = await screen.findByRole("button", { name: "Open @reefcalls" });
    const article = card.closest("article")!;
    expect(within(article).getByText("58%")).toBeInTheDocument();
    expect(within(article).getByText("+312 SOL")).toBeInTheDocument();
    expect(within(article).getByText("Super alpha")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Trending today" })).toBeInTheDocument();
    expect(screen.getByText("No new KOL in the season this week.")).toBeInTheDocument();
    expect(screen.getByText("Where does the money for the buys come from?")).toBeInTheDocument();
  });

  it("clicar num KOL abre a 3ª coluna; o X fecha", async () => {
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Open @reefcalls" }));

    const panel = await screen.findByRole("complementary", { name: "@reefcalls profile" });
    expect(within(panel).getByText("Profile details")).toBeInTheDocument();
    expect(within(panel).getByText("3.6 SOL")).toBeInTheDocument();
    expect(within(panel).getByText("2 h 05 min")).toBeInTheDocument();
    expect(await within(panel).findByText("Bought")).toBeInTheDocument();
    expect(within(panel).getByText("MC $2.4M")).toBeInTheDocument();
    expect(getKol).toHaveBeenCalledWith("reefcalls");
    expect(getFeed).toHaveBeenCalledWith({ kols: ["reefcalls"] }, null);

    await userEvent.click(within(panel).getByRole("button", { name: "Close profile" }));
    expect(screen.queryByRole("complementary", { name: "@reefcalls profile" })).not.toBeInTheDocument();
  });

  it("filtro troca para a grade paginada na ordem pedida", async () => {
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Highest hit rate" }));

    expect(await screen.findByRole("button", { name: "Open @batial" })).toBeInTheDocument();
    expect(getKols).toHaveBeenLastCalledWith({ sort: "hit", q: undefined, offset: 0, limit: 24 });
  });

  it("busca procura em todos, sem o @", async () => {
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.type(screen.getByRole("searchbox", { name: /search kol/i }), "@bat");

    await waitFor(() =>
      expect(getKols).toHaveBeenLastCalledWith({ sort: "pnl", q: "bat", offset: 0, limit: 24 }),
    );
  });

  it("FREE vê o upsell e não consulta nada", async () => {
    plan.isPro = false;
    renderWithQuery(<CopyTradeScreen />);

    expect(screen.getByText("Copy Trade is part of Pro")).toBeInTheDocument();
    expect(getHome).not.toHaveBeenCalled();
  });

  it("com copies: resumo, item ativo e o feed com o que você fez", async () => {
    getOverview.mockResolvedValue({
      ...EMPTY_OVERVIEW,
      summary: { resultSol: 16.3, resultPct: 27, todaySol: 1.9, spark: [0, 1, 2, 4] },
      active: [copyView()],
    });
    getCopyFeed.mockResolvedValue({
      page: 1,
      total: 1,
      items: [
        {
          id: "e1",
          at: new Date().toISOString(),
          kol: { id: "reefcalls", label: "@reefcalls", relevance: 95, avatarUrl: null },
          side: "BUY",
          token: { mint: "Mint1111111111", symbol: "KEKO" },
          kolQuoteSol: 2.1,
          kolMcUsd: 410_000,
          kolMultiple: null,
          decision: "IGNORED",
          reason: "deep_score:48",
          planSol: 0.5,
          filledSol: null,
          pnlSol: null,
        },
      ],
    });
    renderWithQuery(<CopyTradeScreen />);

    const summary = await screen.findByRole("region", { name: "Your copies" });
    expect(within(summary).getByText("+16.3 SOL")).toBeInTheDocument();
    expect(within(summary).getByText(/simulated/)).toBeInTheDocument();
    expect(screen.getByText("Same amount as him, up to 0.5 SOL")).toBeInTheDocument();
    expect(await screen.findByText("Skipped: Deep Score 48")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–1 of 1 events")).toBeInTheDocument();
  });

  it("carteira copiada: caixa Your copy e rodapé Pause / Adjust", async () => {
    getKolCopy.mockResolvedValue({ mode: "shadow", copy: copyView(), events: [] });
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Open @reefcalls" }));

    const panel = await screen.findByRole("complementary", { name: "@reefcalls profile" });
    const box = await within(panel).findByRole("region", { name: "Your copy" });
    expect(within(box).getByText("+12.4 SOL")).toBeInTheDocument();
    expect(within(box).getByText("Simulated")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /pause/i })).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Adjust copy" }));
    const drawer = await screen.findByRole("dialog", { name: "Configure copy" });
    expect(within(drawer).getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });

  it("Copiar @kol cria o copy com o padrão; saldo baixo bloqueia", async () => {
    createCopy.mockResolvedValue(copyView());
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Open @reefcalls" }));
    const panel = await screen.findByRole("complementary", { name: "@reefcalls profile" });
    await userEvent.click(await within(panel).findByRole("button", { name: "Copy @reefcalls" }));

    const drawer = await screen.findByRole("dialog", { name: "Configure copy" });
    expect(within(drawer).getByText(/Simulation mode/)).toBeInTheDocument();
    const amount = within(drawer).getByLabelText("Cap per buy");
    await userEvent.clear(amount);
    await userEvent.type(amount, "9");
    expect(within(drawer).getByText(/Above your W1 balance/)).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Start copying" })).toBeDisabled();

    await userEvent.click(within(drawer).getByRole("button", { name: "0.5 SOL" }));
    await userEvent.click(within(drawer).getByRole("button", { name: "Start copying" }));
    await waitFor(() =>
      expect(createCopy).toHaveBeenCalledWith({ kolId: "reefcalls", config: expect.objectContaining({ v: 1 }) }),
    );
  });

  it("Novo Wallet Copy: vazio trava o formulário; carteira avulsa encontrada libera e cria pelo endereço", async () => {
    resolveAddress.mockReset().mockResolvedValue({
      address: WALLET,
      kol: null,
      stats: { hitRate: 54, pnlSol: 41, trades: 212, partial: false },
    });
    createCopy.mockResolvedValue(
      copyView({ kol: { id: `wallet:${WALLET}`, label: "7xKX…9fQ2", relevance: 0, avatarUrl: null } }),
    );
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Create copy" }));

    const drawer = await screen.findByRole("dialog", { name: "Configure copy" });
    expect(within(drawer).getByRole("heading", { name: "New Wallet Copy" })).toBeInTheDocument();
    expect(within(drawer).getByText("Wallet to copy")).toBeInTheDocument();
    expect(within(drawer).getByText("Amount per buy").closest("[inert]")).not.toBeNull();
    expect(within(drawer).getByRole("button", { name: "Paste the wallet address" })).toBeDisabled();

    await userEvent.type(within(drawer).getByLabelText("Wallet address"), "not-an-address");
    expect(within(drawer).getByRole("alert")).toHaveTextContent("This doesn't look like a Solana address.");
    expect(resolveAddress).not.toHaveBeenCalled();

    await userEvent.click(within(drawer).getByRole("button", { name: "Clear address" }));
    await userEvent.type(within(drawer).getByLabelText("Wallet address"), WALLET);
    expect(await within(drawer).findByText("Found")).toBeInTheDocument();
    expect(resolveAddress).toHaveBeenCalledWith(WALLET);
    expect(within(drawer).getByText("No KOL profile")).toBeInTheDocument();
    expect(within(drawer).getByText("7xKX…9fQ2")).toBeInTheDocument();
    expect(within(drawer).getByText("7X")).toBeInTheDocument();
    expect(within(drawer).getByText("54%")).toBeInTheDocument();
    expect(within(drawer).getByText("+41 SOL")).toBeInTheDocument();
    expect(within(drawer).getByText("212")).toBeInTheDocument();
    expect(within(drawer).getByText("Amount per buy").closest("[inert]")).toBeNull();

    await userEvent.click(within(drawer).getByRole("button", { name: "Start copying" }));
    await waitFor(() =>
      expect(createCopy).toHaveBeenCalledWith({ address: WALLET, config: expect.objectContaining({ v: 1 }) }),
    );
  });

  it("Novo Wallet Copy: carteira de KOL segue pelo KOL", async () => {
    resolveAddress.mockReset().mockResolvedValue({
      address: WALLET,
      kol: { id: "reefcalls", label: "@reefcalls", relevance: 95, avatarUrl: null },
      stats: { hitRate: 58, pnlSol: 312, trades: 1200, partial: true },
    });
    createCopy.mockResolvedValue(copyView());
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Create copy" }));

    const drawer = await screen.findByRole("dialog", { name: "Configure copy" });
    await userEvent.type(within(drawer).getByLabelText("Wallet address"), WALLET);
    expect(await within(drawer).findByText("@reefcalls")).toBeInTheDocument();
    expect(within(drawer).getByText("7xKX…9fQ2")).toBeInTheDocument();
    expect(within(drawer).getByText("1,200+")).toBeInTheDocument();

    await userEvent.click(within(drawer).getByRole("button", { name: "Start copying" }));
    await waitFor(() =>
      expect(createCopy).toHaveBeenCalledWith({ kolId: "reefcalls", config: expect.objectContaining({ v: 1 }) }),
    );
  });

  it("abas Tokens e Who copies (anônima)", async () => {
    getKol.mockResolvedValue({
      kol: kol("reefcalls", { copiers: 3 }),
      series: Array.from({ length: 30 }, () => 0),
      tokenSummary: { total: 2, profitable: 1, bestMultiple: 4.6, open: 1 },
      tokens: [
        { mint: "A1", symbol: "KEKO", name: null, imageUrl: null, mcUsd: 700_000, boughtSol: 1, soldSol: 0, pnlSol: 0, lastAt: new Date().toISOString(), entryMcUsd: 410_000, open: true, holdMs: 11 * 60_000, multiple: 1.8 },
        { mint: "B2", symbol: "BRAIN", name: null, imageUrl: null, mcUsd: null, boughtSol: 1, soldSol: 4.6, pnlSol: 3.6, lastAt: new Date().toISOString(), entryMcUsd: 86_000, open: false, holdMs: 2 * 3_600_000, multiple: 4.6 },
      ],
      updatedAt: new Date().toISOString(),
    });
    getCopiers.mockResolvedValue({
      count: 3,
      avgResultPct: 18,
      profitable: 2,
      losing: 1,
      tip: { minDeepScore: 60, deltaPct: 24 },
      me: null,
      page: 1,
      rows: [
        { rank: 1, alias: "KX", mine: false, sinceDays: 28, resultPct: 64 },
        { rank: 2, alias: "MR", mine: false, sinceDays: 30, resultPct: -5 },
      ],
    });
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Open @reefcalls" }));
    const panel = await screen.findByRole("complementary", { name: "@reefcalls profile" });

    await userEvent.click(within(panel).getByRole("tab", { name: /tokens/i }));
    expect(await within(panel).findByText("1 of 2")).toBeInTheDocument();
    expect(within(panel).getByText("Entered at $410k")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: /closed/i }));
    expect(within(panel).queryByText("$KEKO")).not.toBeInTheDocument();
    expect(within(panel).getByText("$BRAIN")).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("tab", { name: /who copies/i }));
    expect(await within(panel).findByText("2 in profit")).toBeInTheDocument();
    expect(within(panel).getByText(/did 24% better/)).toBeInTheDocument();
    expect(within(panel).getByText("KX")).toBeInTheDocument();
    // Cabeçalho da coluna + 2 linhas — ninguém aparece pelo @.
    expect(within(panel).getAllByText("Copier")).toHaveLength(3);
    expect(within(panel).queryByText(/@lucas/)).not.toBeInTheDocument();
  });
});
