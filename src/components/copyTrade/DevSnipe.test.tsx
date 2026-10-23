import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CopyTradeScreen } from "./CopyTradeScreen";
import * as copyTrade from "@/lib/api/copyTrade";
import * as devSnipe from "@/lib/api/devSnipe";
import { DEFAULT_SNIPE_CONFIG } from "@/lib/devSnipe/config";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/api/copyTrade", async (importOriginal) => {
  const actual = await importOriginal<typeof copyTrade>();
  return {
    ...actual,
    getCopyTradeHome: vi.fn(),
    getCopyKols: vi.fn(),
    getCopyOverview: vi.fn(),
    getCopyFeed: vi.fn(),
  };
});
vi.mock("@/lib/api/devSnipe", async (importOriginal) => {
  const actual = await importOriginal<typeof devSnipe>();
  return {
    ...actual,
    getSnipeOverview: vi.fn(),
    getTrendingDevs: vi.fn(),
    getLaunches: vi.fn(),
    resolveDev: vi.fn(),
    createSnipe: vi.fn(),
    updateSnipe: vi.fn(),
    snipeAction: vi.fn(),
  };
});
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
const plan = vi.hoisted(() => ({ isPro: true }));
vi.mock("@/lib/billing/usePlan", () => ({
  usePlan: () => ({ plan: plan.isPro ? "PRO" : "FREE", isPro: plan.isPro, isLoading: false }),
}));
vi.mock("@/components/home/Topbar", () => ({ Topbar: () => <header /> }));
vi.mock("react-hot-toast", () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const api = {
  overview: vi.mocked(devSnipe.getSnipeOverview),
  devs: vi.mocked(devSnipe.getTrendingDevs),
  launches: vi.mocked(devSnipe.getLaunches),
  resolve: vi.mocked(devSnipe.resolveDev),
  create: vi.mocked(devSnipe.createSnipe),
  update: vi.mocked(devSnipe.updateSnipe),
  action: vi.mocked(devSnipe.snipeAction),
};

const DEV = "DEVx9rQ4mWbP2tLz8KcYv1HnA5sJ7dEk3Pa";
const DEV2 = "7Gq2Nf8wTzR1bV9mYcA3dLpE6sJ4hUMn8T";
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const stats = (p: Partial<devSnipe.DevStats> = {}): devSnipe.DevStats => ({
  tokens: 12,
  migrated: 5,
  migrationRate: 42,
  bestMultiple: 18,
  lastLaunchAt: ago(2 * 86_400_000),
  recent: [true, false, true, false, false, true, false, true, false, false, true, false],
  ...p,
});

const snipe = (p: Partial<devSnipe.SnipeView> = {}): devSnipe.SnipeView => ({
  id: "s1",
  dev: DEV,
  label: "DEVx…k3Pa",
  status: "ACTIVE",
  config: structuredClone(DEFAULT_SNIPE_CONFIG),
  sniped: 0,
  resultSol: null,
  createdAt: ago(3_600_000),
  ...p,
});

const launch = (i: number, p: Partial<devSnipe.LaunchRow> = {}): devSnipe.LaunchRow => ({
  mint: `Mint${i}`,
  symbol: `TOK${i}`,
  name: null,
  dev: DEV,
  devLabel: "DEVx…k3Pa",
  createdAt: ago(2 * 60_000),
  mcUsd: 46_000,
  devHistory: { migrated: 4, tokens: 12 },
  snipes: 0,
  mine: false,
  ...p,
});

const OVERVIEW: devSnipe.SnipeOverview = {
  mode: "shadow",
  w1: null,
  waiting: [snipe(), snipe({ id: "s2", dev: DEV2, label: "7Gq2…Mn8T", status: "PAUSED", sniped: 1, config: { ...DEFAULT_SNIPE_CONFIG, amountSol: 1, maxTokens: 3 } })],
  fired: [
    { snipeId: "s9", dev: "Hx9PqT2wQd", label: "Hx9P…2wQd", mint: "MintG", symbol: "GLUB", resultSol: 0.65, multiple: 2.3, open: false, at: ago(60_000) },
    { snipeId: "s8", dev: "Pq1LxT8sNa", label: "Pq1L…8sNa", mint: "MintN", symbol: "NOODLE", resultSol: -0.2, multiple: 0.6, open: false, at: ago(60_000) },
  ],
};

const setUrl = (search: string) => window.history.replaceState(null, "", `/copy-trade${search}`);

describe("Dev Snipe", () => {
  beforeEach(() => {
    plan.isPro = true;
    setUrl("?type=snipe");
    vi.mocked(copyTrade.getCopyOverview).mockReset().mockResolvedValue({
      mode: "shadow",
      w1: null,
      summary: { resultSol: 0, resultPct: null, todaySol: 0, spark: [] },
      active: [],
      history: [],
    });
    vi.mocked(copyTrade.getCopyTradeHome).mockReset().mockResolvedValue({
      forYou: [],
      trending: [],
      topHit: [],
      newInRanking: [],
      updatedAt: new Date().toISOString(),
    });
    vi.mocked(copyTrade.getCopyKols).mockReset().mockResolvedValue({ items: [], total: 0 });
    vi.mocked(copyTrade.getCopyFeed).mockReset().mockResolvedValue({ items: [], total: 0, page: 1 });
    api.overview.mockReset().mockResolvedValue(OVERVIEW);
    api.devs.mockReset().mockResolvedValue([{ address: DEV, stats: stats() }]);
    api.launches.mockReset().mockImplementation(async (page: number) => ({
      page,
      total: 38,
      items: [
        launch(1, { snipes: 2 }),
        launch(2, { snipes: 5, mine: true }),
        launch(3),
        ...Array.from({ length: 7 }, (_, i) => launch(page * 100 + i, { snipes: 1 })),
      ],
    }));
    api.resolve.mockReset().mockResolvedValue({ address: DEV, stats: stats() });
    api.create.mockReset().mockResolvedValue(snipe());
    api.update.mockReset().mockResolvedValue(snipe());
    api.action.mockReset().mockResolvedValue(snipe({ status: "PAUSED" }));
  });

  afterEach(() => setUrl(""));

  it("abas: troca entre Wallet Copy e Dev Snipe e guarda na URL", async () => {
    setUrl("");
    renderWithQuery(<CopyTradeScreen />);

    expect(screen.getByRole("heading", { name: "Create copy" })).toBeInTheDocument();
    expect(screen.getByText("Copies a wallet's buys and sells")).toBeInTheDocument();
    // Contagem da aba inativa: snipes aguardando.
    const tab = screen.getByRole("tab", { name: /dev snipe/i });
    await waitFor(() => expect(tab).toHaveTextContent("2"));

    await userEvent.click(tab);
    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(window.location.search).toBe("?type=snipe");
    expect(screen.getByRole("heading", { name: "Create Dev Snipe" })).toBeInTheDocument();
    expect(screen.getByText("Buys the next token a dev launches")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /wallet copy/i }));
    expect(window.location.search).toBe("");
    expect(screen.getByRole("heading", { name: "Create copy" })).toBeInTheDocument();
  });

  it("home: aguardando, disparados, devs em alta e lançamentos paginados", async () => {
    renderWithQuery(<CopyTradeScreen />);

    const waiting = await screen.findByRole("button", { name: "Adjust snipe on DEVx…k3Pa" });
    expect(within(waiting).getByText("0 of 1")).toBeInTheDocument();
    expect(within(waiting).getByText("waiting")).toBeInTheDocument();
    expect(within(waiting).getByText("0.5 SOL per token")).toBeInTheDocument();
    const paused = screen.getByRole("button", { name: "Adjust snipe on 7Gq2…Mn8T" });
    expect(within(paused).getByText("1 of 3")).toBeInTheDocument();
    expect(within(paused).getByText("paused")).toBeInTheDocument();

    expect(screen.getByText("Bought $GLUB")).toBeInTheDocument();
    expect(screen.getByText("+0.65 SOL")).toHaveClass("text-green-11");
    expect(screen.getByText("2.3x")).toBeInTheDocument();
    expect(screen.getByText("−0.2 SOL")).toHaveClass("text-vermelho-11");

    const card = (await screen.findByRole("button", { name: "Snipe DEVx…k3Pa" })).closest("article")!;
    expect(within(card).getByText("42%")).toBeInTheDocument();
    expect(within(card).getByText("5 of 12 migrated")).toBeInTheDocument();
    expect(within(card).getByText("Last launch 2 days ago")).toBeInTheDocument();
    expect(within(card).getByText("18x")).toBeInTheDocument();

    const table = await screen.findByRole("table");
    expect(within(table).getByText("2 snipes")).toBeInTheDocument();
    expect(within(table).getByText("You bought")).toHaveClass("text-green-11");
    expect(within(table).getByText("—")).toBeInTheDocument();
    expect(within(table).getAllByText("$46k").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Migrated 4 of 12").length).toBe(10);
    expect(within(table).getAllByText("2 min ago").length).toBe(10);
    expect(screen.getByText("Showing 1–10 of 38 launches")).toBeInTheDocument();
    expect(api.launches).toHaveBeenLastCalledWith(1, 10);

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(api.launches).toHaveBeenLastCalledWith(2, 10));
    expect(await screen.findByText("Showing 11–20 of 38 launches")).toBeInTheDocument();
  });

  it("drawer: vazio → dev encontrado → regras (atraso só uma vez) → cria com o payload", async () => {
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Create Dev Snipe" }));

    const drawer = await screen.findByRole("dialog", { name: "New Dev Snipe" });
    expect(within(drawer).getByText(/anti-sniper fee/)).toBeInTheDocument();
    expect(within(drawer).getByText("Buy amount").closest("[inert]")).not.toBeNull();
    expect(within(drawer).getByRole("button", { name: "Paste the dev wallet" })).toBeDisabled();

    await userEvent.type(within(drawer).getByLabelText("Dev wallet address"), "nope");
    expect(within(drawer).getByRole("alert")).toHaveTextContent("This doesn't look like a Solana address.");
    expect(api.resolve).not.toHaveBeenCalled();

    await userEvent.click(within(drawer).getByRole("button", { name: "Clear address" }));
    await userEvent.type(within(drawer).getByLabelText("Dev wallet address"), DEV);
    expect(await within(drawer).findByText("Found")).toBeInTheDocument();
    expect(api.resolve).toHaveBeenCalledWith(DEV);
    expect(within(drawer).getByText("DEVx…k3Pa")).toBeInTheDocument();
    expect(within(drawer).getByText("Tokens created")).toBeInTheDocument();
    expect(within(drawer).getByText("42%")).toBeInTheDocument();
    expect(within(drawer).getByText("Buy amount").closest("[inert]")).toBeNull();
    expect(within(drawer).getByText(/Simulation mode/)).toBeInTheDocument();
    expect(within(drawer).getByText("Stop after 1 token")).toBeInTheDocument();
    expect(within(drawer).getByText("Buy and sell: auto slippage, priority 0.008 SOL")).toBeInTheDocument();

    // "My rules" sem regras começa com as três do design.
    await userEvent.click(within(drawer).getByText("My rules"));
    expect(within(drawer).getAllByRole("button", { name: /^Remove rule/ })).toHaveLength(3);
    expect(within(drawer).getByLabelText("Rule 3 trigger")).toHaveValue(-50);

    // Menu: Price / Events; Delay entra no fim e depois fica desabilitado.
    await userEvent.click(within(drawer).getByRole("button", { name: "+ Add rule" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Price")).toBeInTheDocument();
    expect(within(menu).getByText("Events")).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("menuitem", { name: /^Delay/ }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(within(drawer).getByLabelText("Rule 4 minimum delay")).toHaveValue(5);
    expect(within(drawer).getByLabelText("Rule 4 maximum delay")).toHaveValue(30);

    await userEvent.click(within(drawer).getByRole("button", { name: "+ Add rule" }));
    const again = await screen.findByRole("menu");
    expect(within(again).getByRole("menuitem", { name: /^Delay/ })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(within(again).getByRole("menuitem", { name: /^Trailing stop-loss/ }));
    expect(within(drawer).getByLabelText("Rule 5 drop")).toHaveValue(30);

    // Esc fecha só o menu; o drawer continua aberto.
    await userEvent.click(within(drawer).getByRole("button", { name: "+ Add rule" }));
    await screen.findByRole("menu");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(screen.getByRole("dialog", { name: "New Dev Snipe" })).toBeInTheDocument();

    // Remove o 1º lucro e a regra de trailing.
    await userEvent.click(within(drawer).getByRole("button", { name: "Remove rule 5 (Trailing stop-loss)" }));
    await userEvent.click(within(drawer).getByRole("button", { name: "Remove rule 1 (Profit)" }));
    expect(within(drawer).getAllByRole("button", { name: /^Remove rule/ })).toHaveLength(3);

    // Validação: perda positiva barra o botão.
    const loss = within(drawer).getByLabelText("Rule 2 trigger");
    // fireEvent: o jsdom descarta o "-" digitado sozinho num input number.
    fireEvent.change(loss, { target: { value: "10" } });
    expect(within(drawer).getByText("Loss rules must be between −1% and −99%.")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Activate Dev Snipe" })).toBeDisabled();
    fireEvent.change(loss, { target: { value: "-40" } });

    await userEvent.click(within(drawer).getByRole("button", { name: "1 SOL" }));
    await userEvent.click(within(drawer).getByRole("button", { name: "Activate Dev Snipe" }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        dev: DEV,
        config: {
          v: 1,
          amountSol: 1,
          maxTokens: 1,
          sell: {
            mode: "rules",
            rules: [
              { kind: "tp", atPct: 300, sellPct: 100 },
              { kind: "sl", atPct: -40, sellPct: 100 },
              { kind: "delay", minS: 5, maxS: 30 },
            ],
          },
          execution: { slippageBps: null, priorityFeeSol: 0.008, antiMev: true },
        },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // Fluxo longo (digitação do endereço + menu três vezes): mais folga que os 5 s padrão.
  }, 20_000);

  it("dev sem lançamentos ainda conta como encontrado", async () => {
    api.resolve.mockResolvedValue({ address: DEV, stats: null });
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Create Dev Snipe" }));
    const drawer = await screen.findByRole("dialog", { name: "New Dev Snipe" });
    await userEvent.type(within(drawer).getByLabelText("Dev wallet address"), DEV);

    expect(await within(drawer).findByText("No launches on pump.fun yet")).toBeInTheDocument();
    expect(within(drawer).getAllByText("—")).toHaveLength(3);
    await userEvent.click(within(drawer).getByRole("button", { name: "Activate Dev Snipe" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith({ dev: DEV, config: expect.objectContaining({ sell: { mode: "none", rules: [] } }) }));
  });

  it("Snipe no card abre o drawer com o dev preenchido e resolvido", async () => {
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Snipe DEVx…k3Pa" }));

    const drawer = await screen.findByRole("dialog", { name: "New Dev Snipe" });
    expect(within(drawer).getByLabelText("Dev wallet address")).toHaveValue(DEV);
    expect(await within(drawer).findByText("Found")).toBeInTheDocument();
    expect(api.resolve).toHaveBeenCalledWith(DEV);
  });

  it("ajustar: endereço travado, salvar, pausar e parar", async () => {
    renderWithQuery(<CopyTradeScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Adjust snipe on DEVx…k3Pa" }));

    let drawer = await screen.findByRole("dialog", { name: "Adjust Dev Snipe" });
    expect(within(drawer).getByLabelText("Dev wallet address")).toHaveAttribute("readonly");
    expect(within(drawer).queryByRole("button", { name: "Clear address" })).not.toBeInTheDocument();
    // O formulário não espera a prévia: o snipe já existe.
    expect(within(drawer).getByText("Buy amount").closest("[inert]")).toBeNull();

    await userEvent.click(within(drawer).getByRole("button", { name: "0.25 SOL" }));
    await userEvent.click(within(drawer).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("s1", expect.objectContaining({ amountSol: 0.25 })));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Adjust snipe on DEVx…k3Pa" }));
    drawer = await screen.findByRole("dialog", { name: "Adjust Dev Snipe" });
    await userEvent.click(within(drawer).getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(api.action).toHaveBeenCalledWith("s1", "pause"));

    await userEvent.click(await screen.findByRole("button", { name: "Adjust snipe on 7Gq2…Mn8T" }));
    drawer = await screen.findByRole("dialog", { name: "Adjust Dev Snipe" });
    expect(within(drawer).getByRole("button", { name: "Resume" })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: "Stop snipe" }));
    expect(api.action).not.toHaveBeenCalledWith("s2", "end");
    await userEvent.click(within(drawer).getByRole("button", { name: "Click again to stop this snipe" }));
    await waitFor(() => expect(api.action).toHaveBeenCalledWith("s2", "end"));
  });

  it("FREE vê o upsell do Dev Snipe e não consulta nada", async () => {
    plan.isPro = false;
    renderWithQuery(<CopyTradeScreen />);

    expect(screen.getByText("Dev Snipe is part of Pro")).toBeInTheDocument();
    expect(api.devs).not.toHaveBeenCalled();
    expect(api.launches).not.toHaveBeenCalled();
    expect(api.overview).not.toHaveBeenCalled();
  });
});
