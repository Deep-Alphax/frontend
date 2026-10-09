import { api } from "@/lib/api/client";

/*
 * Tracker (SocialFi Wallet Tracker) — espelha `backend/src/app/tracker/tracker.types.ts`.
 * Dinheiro chega como number já arredondado (exibição); null = desconhecido.
 */

export type TrackerChain = "SOLANA" | "ETHEREUM" | "BASE" | "BSC" | "ARBITRUM" | "POLYGON" | "OPTIMISM";
export type FeedPlatform = "DISCORD" | "TELEGRAM" | "PUMPFUN" | "FOMO";

export interface TrackerToken {
  chain: TrackerChain;
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  mcUsd: number | null;
}

export interface TrackerKol {
  id: string;
  name: string;
  handle: string | null;
  relevance: number;
}

export interface TrackerTrade {
  id: string;
  side: "BUY" | "SELL";
  quoteSymbol: string;
  quoteAmount: number;
  usdValue: number;
  mcUsd: number | null;
  at: string;
  relation: { kind: "before" | "after"; minutes: number } | null;
}

export type ThreadStatus =
  | "bought_before"
  | "sold_after"
  | "bought_sold"
  | "entered_after"
  | "talk_only"
  | "silent_buy"
  | "strike";

export interface TrackerFeedItem {
  id: string;
  status: ThreadStatus;
  kol: TrackerKol;
  token: TrackerToken;
  call: { messageId: string; text: string; platform: FeedPlatform; group: string | null; at: string } | null;
  trades: TrackerTrade[];
  pnlUsd: number | null;
  strike: { medianMultiple: number; balancePct: number | null; largest30d: boolean; hits: boolean[] } | null;
  lastActivityAt: string;
}

export interface TrackerFeedPage {
  items: TrackerFeedItem[];
  nextCursor: string | null;
}

export interface ConfluenceItem {
  token: TrackerToken;
  score: number;
  wallets: number;
  changeSinceFirst: number | null;
  firstBuyAt: string;
  live: boolean;
}

export interface MultiBuyItem {
  token: TrackerToken;
  wallets: number;
  kols: Array<{ id: string; name: string; relevance: number }>;
  buyUsd: number;
  lastBuyAt: string;
}

export interface NetFlowItem {
  token: TrackerToken;
  buyUsd: number;
  sellUsd: number;
  netUsd: number;
  wallets: number;
}

export interface TopSourceItem {
  platform: FeedPlatform;
  group: string;
  calls: number;
  hits: number;
  hitRate: number;
  best: { symbol: string | null; multiple: number } | null;
}

export interface DiscoveryItem {
  chain: TrackerChain;
  address: string;
  pnl30dUsd: number | null;
  runnersCaught: number;
  runnersTotal: number;
  pattern: boolean[];
  tokens: Array<{ chain: TrackerChain; mint: string; symbol: string | null }>;
  following: boolean;
}

export interface TrackerFilterOptions {
  kols: Array<{ id: string; name: string; relevance: number }>;
  totalKols: number;
}

export type TrackerEvent = "all" | "buys" | "sells" | "calls" | "strikes";
export type SourcePeriod = "7d" | "15d";

/** Filtros do feed. `source` = `PLATFORM:grupo` (Top sources → Filter). */
export interface TrackerFeedFilters {
  chain?: "SOLANA" | "ETHEREUM" | "BASE" | "BSC";
  event?: TrackerEvent;
  minUsd?: number;
  kols?: string[];
  source?: string;
}

export const TRACKER_KEY = ["tracker"] as const;

export async function getTrackerFeed(
  filters: TrackerFeedFilters,
  cursor: string | null,
): Promise<TrackerFeedPage> {
  const { data } = await api.get<TrackerFeedPage>("/api/v1/tracker/feed", {
    params: {
      cursor: cursor ?? undefined,
      chain: filters.chain,
      event: filters.event && filters.event !== "all" ? filters.event : undefined,
      minUsd: filters.minUsd || undefined,
      kols: filters.kols?.length ? filters.kols.join(",") : undefined,
      source: filters.source,
    },
  });
  return data;
}

export const getConfluence = async () =>
  (await api.get<ConfluenceItem[]>("/api/v1/tracker/confluence")).data;
export const getMultiBuys = async () =>
  (await api.get<MultiBuyItem[]>("/api/v1/tracker/multi-buys")).data;
export const getNetFlows = async () =>
  (await api.get<NetFlowItem[]>("/api/v1/tracker/net-flows")).data;
export const getTopSources = async (period: SourcePeriod) =>
  (await api.get<TopSourceItem[]>("/api/v1/tracker/sources", { params: { period } })).data;
export const getDiscovery = async () =>
  (await api.get<DiscoveryItem[]>("/api/v1/tracker/discovery")).data;
export const getTrackerFilters = async () =>
  (await api.get<TrackerFilterOptions>("/api/v1/tracker/filters")).data;

export async function setFollow(chain: TrackerChain, address: string, follow: boolean): Promise<void> {
  if (follow) await api.post("/api/v1/tracker/follows", { chain, address });
  else await api.delete("/api/v1/tracker/follows", { data: { chain, address } });
}

// ───────────────────────── Drawer do token (Figma 1411:34396) ─────────────────────────

export type TokenDetailStatus = "normal" | "risk" | "rugged";
export type TokenSignalId =
  | "kols_bought"
  | "groups_called"
  | "rick"
  | "volume"
  | "holders"
  | "liquidity"
  | "dev"
  | "bundle";
/** `off` = medido e não aconteceu; `unknown` = sem fonte de dados (não pontua). */
export type SignalState = "good" | "bad" | "off" | "unknown";
export type DeepScoreTier = "strong" | "moderate" | "danger";
export type HolderRowId = "top10" | "dev" | "snipers" | "insiders" | "bundlers" | "lp" | "fresh";

export interface TokenWalletActivity {
  kol: TrackerKol;
  types: string[];
  callOwner: boolean;
  action: "BUY" | "SELL";
  quoteSymbol: string;
  quoteAmount: number;
  entryMcUsd: number | null;
  supplyPct: number | null;
  lastAt: string;
  pnlUsd: number | null;
  multiple: number | null;
  exited: boolean;
}

export interface TokenCall {
  id: string;
  author: string;
  platform: FeedPlatform;
  group: string | null;
  at: string;
  text: string;
  relation: "bought_before" | "sold_after" | "entered_after" | null;
  mcAtCall: number | null;
  multiple: number | null;
}

export interface TokenDetail {
  token: TrackerToken;
  status: TokenDetailStatus;
  live: boolean;
  launchpad: string | null;
  launchedAt: string | null;
  kpis: {
    mcUsd: number | null;
    change24h: number | null;
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    holders: number | null;
  };
  links: {
    explorer: string;
    twitter: string | null;
    telegram: string | null;
    website: string | null;
    dexUrl: string | null;
    dexPaid: boolean | null;
  };
  exit: {
    liquidityDrop: { pct: number; minutes: number } | null;
    mcDropFromHigh: number | null;
    exitedKols: string[];
    rugAt: string | null;
    stuckWallets: number;
  };
  signals: Array<{ id: TokenSignalId; state: SignalState }>;
  deepScore: { score: number; tier: DeepScoreTier };
  chart: {
    points: Array<{ t: string; mc: number }>;
    /** "call", "sniper" ou o id do nível do KOL (gold, diamond…). */
    markers: Array<{ t: string; kind: string }>;
  };
  holders: {
    rows: Array<{ id: HolderRowId; pct: number | null; tone: "good" | "warn" | "bad" | "none" }>;
    updatedAt: string | null;
  };
  wallets: { smartMoneyUsd: number; items: TokenWalletActivity[] };
  calls: TokenCall[];
  updatedAt: string;
}

/** Token aberto no drawer (o que o clique já sabe — o resto vem do servidor). */
export type TokenRef = Pick<TrackerToken, "chain" | "mint" | "symbol" | "name" | "imageUrl" | "mcUsd">;

export async function getTokenDetail(chain: TrackerChain, mint: string): Promise<TokenDetail> {
  const { data } = await api.get<TokenDetail>(
    `/api/v1/tracker/token/${encodeURIComponent(chain)}/${encodeURIComponent(mint)}`,
  );
  return data;
}
