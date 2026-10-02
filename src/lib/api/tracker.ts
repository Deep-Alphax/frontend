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
