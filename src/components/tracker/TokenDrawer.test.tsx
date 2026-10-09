import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TokenDrawer } from "./TokenDrawer";
import * as tracker from "@/lib/api/tracker";
import * as alerts from "@/lib/api/alerts";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/api/tracker", async (importOriginal) => {
  const actual = await importOriginal<typeof tracker>();
  return { ...actual, getTokenDetail: vi.fn() };
});
vi.mock("@/lib/api/alerts", async (importOriginal) => {
  const actual = await importOriginal<typeof alerts>();
  return { ...actual, createAlertRule: vi.fn() };
});

const getDetail = vi.mocked(tracker.getTokenDetail);
const createRule = vi.mocked(alerts.createAlertRule);

const MINT = "Fr0iNk7aQ4d1s9bYhW3kPz8mX2cVuR6tL5nJ1pump";
const REF: tracker.TokenRef = {
  chain: "SOLANA",
  mint: MINT,
  symbol: "FROINK",
  name: "Froink",
  imageUrl: null,
  mcUsd: 1_340_000,
};
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

function detail(over: Partial<tracker.TokenDetail> = {}): tracker.TokenDetail {
  return {
    token: { ...REF },
    status: "normal",
    live: true,
    launchpad: "Pump.fun",
    launchedAt: ago(120),
    kpis: { mcUsd: 1_340_000, change24h: 0.38, liquidityUsd: 392_000, volume24hUsd: 2_100_000, holders: 4912 },
    links: {
      explorer: `https://solscan.io/token/${MINT}`,
      twitter: "https://x.com/froink",
      telegram: "https://t.me/froink",
      website: null,
      dexUrl: "https://dexscreener.com/solana/pair",
      dexPaid: true,
    },
    exit: { liquidityDrop: null, mcDropFromHigh: null, exitedKols: [], rugAt: null, stuckWallets: 0 },
    signals: [
      { id: "kols_bought", state: "good" },
      { id: "groups_called", state: "good" },
      { id: "rick", state: "unknown" },
      { id: "volume", state: "good" },
      { id: "holders", state: "good" },
      { id: "liquidity", state: "good" },
      { id: "dev", state: "unknown" },
      { id: "bundle", state: "unknown" },
    ],
    deepScore: { score: 81, tier: "strong" },
    chart: {
      points: [
        { t: ago(30), mc: 400_000 },
        { t: ago(0), mc: 1_340_000 },
      ],
      markers: [{ t: ago(15), kind: "gold" }],
    },
    holders: {
      rows: [
        { id: "top10", pct: 14, tone: "good" },
        { id: "dev", pct: null, tone: "none" },
        { id: "lp", pct: 100, tone: "good" },
      ],
      updatedAt: ago(0),
    },
    wallets: {
      smartMoneyUsd: 14_200,
      items: [
        {
          kol: { id: "k1", name: "Point", handle: "pointfarmcap", relevance: 95 },
          types: [],
          callOwner: true,
          action: "BUY",
          quoteSymbol: "SOL",
          quoteAmount: 0.8,
          entryMcUsd: 410_000,
          supplyPct: 0.8,
          lastAt: ago(8),
          pnlUsd: 2140,
          multiple: 3.3,
          exited: false,
        },
        {
          kol: { id: "k2", name: "Sniper Sam", handle: "samsnipes", relevance: 40 },
          types: ["sniper"],
          callOwner: false,
          action: "SELL",
          quoteSymbol: "SOL",
          quoteAmount: 2.4,
          entryMcUsd: 300_000,
          supplyPct: 0,
          lastAt: ago(31),
          pnlUsd: 1200,
          multiple: 4.5,
          exited: true,
        },
      ],
    },
    calls: [
      {
        id: "c1",
        author: "@pointfarmcap",
        platform: "TELEGRAM",
        group: "Alpha Calls BR",
        at: ago(31),
        text: "$FROINK going to 2M, write it down.",
        relation: "bought_before",
        mcAtCall: 300_000,
        multiple: 4.5,
      },
    ],
    updatedAt: ago(0),
    ...over,
  };
}

describe("TokenDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDetail.mockResolvedValue(detail());
  });

  it("carregando: resumo com o que o clique sabe + skeleton no corpo", () => {
    getDetail.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<TokenDrawer token={REF} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Token details" });
    expect(within(dialog).getByText("$FROINK")).toBeInTheDocument();
    expect(within(dialog).getByText("$1.34M")).toBeInTheDocument();
    expect(within(dialog).getByRole("status", { name: "" })).toHaveTextContent("Loading token details");
    expect(within(dialog).getByRole("link", { name: /Buy/ })).toHaveAttribute("href", `https://axiom.trade/t/${MINT}`);
  });

  it("padrão: KPIs, links, sinais, Deep Score, carteiras e calls", async () => {
    renderWithQuery(<TokenDrawer token={REF} onClose={() => {}} />);
    expect(await screen.findByText("5 of 8 signals")).toBeInTheDocument();
    expect(getDetail).toHaveBeenCalledWith("SOLANA", MINT);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Pump.fun, launched 2 h ago")).toBeInTheDocument();
    expect(screen.getByText("+38%")).toBeInTheDocument();
    expect(screen.getByText("4,912")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DS paid" })).toHaveAttribute("href", "https://dexscreener.com/solana/pair");
    expect(screen.getByRole("link", { name: "Solscan" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Site" })).not.toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Deep Score" })).toHaveAttribute("aria-valuenow", "81");
    expect(screen.getByText("Clean holders")).toBeInTheDocument();
    expect(screen.getByText("Smart money $14.2k")).toBeInTheDocument();
    const wallets = screen.getByRole("list", { name: "Wallets" });
    expect(within(wallets).getByText("@pointfarmcap")).toBeInTheDocument();
    expect(screen.getByText("Call owner")).toBeInTheDocument();
    expect(screen.getByText("$FROINK going to 2M, write it down.")).toBeInTheDocument();
    expect(screen.getByText("bought before")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Buy$/ })).toBeInTheDocument();
  });

  it("filtro de carteiras usa o tipo de trader do KOL", async () => {
    renderWithQuery(<TokenDrawer token={REF} onClose={() => {}} />);
    await screen.findByText("5 of 8 signals");
    await userEvent.click(screen.getByRole("tab", { name: /Snipers/ }));
    const wallets = screen.getByRole("list", { name: "Wallets" });
    expect(within(wallets).getByText("@samsnipes")).toBeInTheDocument();
    expect(within(wallets).queryByText("@pointfarmcap")).not.toBeInTheDocument();
    expect(screen.getByText("exited")).toBeInTheDocument();
  });

  it("risco: banner de saída e 'Buy anyway'", async () => {
    getDetail.mockResolvedValue(
      detail({
        status: "risk",
        exit: {
          liquidityDrop: { pct: 0.62, minutes: 10 },
          mcDropFromHigh: null,
          exitedKols: ["@samsnipes"],
          rugAt: null,
          stuckWallets: 0,
        },
        deepScore: { score: 26, tier: "danger" },
      }),
    );
    renderWithQuery(<TokenDrawer token={REF} onClose={() => {}} />);
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Exit signals: liquidity down 62% in 10 min");
    expect(banner).toHaveTextContent("@samsnipes already exited. Be careful entering.");
    expect(screen.getByText("Danger")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buy anyway/ })).toBeInTheDocument();
  });

  it("rugado: selo, banner tracejado e negociação indisponível", async () => {
    getDetail.mockResolvedValue(
      detail({
        status: "rugged",
        live: false,
        exit: { liquidityDrop: null, mcDropFromHigh: null, exitedKols: [], rugAt: ago(1), stuckWallets: 4 },
        deepScore: { score: 0, tier: "danger" },
      }),
    );
    renderWithQuery(<TokenDrawer token={REF} onClose={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Token rugged: liquidity was removed 1 min ago");
    expect(screen.getByText("Rugged")).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.getByText("Trading unavailable")).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("link", { name: /Buy/ })).not.toBeInTheDocument();
  });

  it("sino cria alerta KEYWORD com o contrato", async () => {
    createRule.mockResolvedValue({
      id: "r1",
      kind: "KEYWORD",
      value: MINT.toLowerCase(),
      label: "$FROINK calls",
      isActive: true,
      effective: true,
      createdAt: ago(0),
    });
    renderWithQuery(<TokenDrawer token={REF} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Alert me when a group calls $FROINK" }));
    await waitFor(() =>
      expect(createRule).toHaveBeenCalledWith({ kind: "KEYWORD", value: MINT, label: "$FROINK calls" }),
    );
  });

  it("Esc e o botão de fechar chamam onClose", async () => {
    const onClose = vi.fn();
    renderWithQuery(<TokenDrawer token={REF} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("fechado não renderiza nada", () => {
    renderWithQuery(<TokenDrawer token={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getDetail).not.toHaveBeenCalled();
  });
});
