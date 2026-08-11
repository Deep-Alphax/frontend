import { api } from "@/lib/api/client";

/** Janela de agregação suportada pelo backend. */
export type MetricPeriod = "D30" | "D90" | "M12";

export interface CapitalPoint {
  date: string; // YYYY-MM-DD
  cumulativePnlUsd: string;
}

export interface DayBucket {
  date: string;
  trades: number;
  realizedPnlUsd: string;
}

export interface WeekdayBlockCell {
  weekday: number; // 0=Seg … 6=Dom
  block: number; // 0..5 (00–04h … 20–24h)
  trades: number;
  realizedPnlUsd: string;
  avgPnlPerTradeUsd: string;
}

export type OutcomeKey = "rugpull" | "stop_loss" | "x1_2" | "x2_5" | "x5_plus";

export interface OutcomeBucket {
  bucket: OutcomeKey;
  count: number;
  pctOfClosed: number;
  realizedPnlUsd: string;
}

export interface ConcentrationBucket {
  count: number;
  pnlUsd: string;
  pct: number;
}

/**
 * Subconjunto do `PnlResult` (backend) consumido pelo dashboard. O endpoint
 * retorna o objeto direto (não embrulhado em `{ data }`).
 */
export interface PortfolioAnalytics {
  totalTrades: number;
  realizedPnlUsd: string;
  tradingPnlUsd: string;
  netPnlUsd: string;
  feesUsd: string;
  volumeUsd: string;

  daily: DayBucket[];
  weekdayBlocks: WeekdayBlockCell[];
  perDay: {
    activeDays: number;
    avgTradesPerActiveDay: number;
    avgPnlPerTrade: string;
    bestDay: DayBucket | null;
    worstDay: DayBucket | null;
  };

  winRate: {
    closed: number;
    winners: number;
    losers: number;
    winRatePct: number;
  };
  profitConcentration: {
    totalUsd: string;
    closedTrades: number;
    top3: ConcentrationBucket;
    next7: ConcentrationBucket;
    rest: ConcentrationBucket;
  };
  outcomes: OutcomeBucket[];
  capital: {
    points: CapitalPoint[];
    maxDrawdownUsd: string;
    daysInGreen: number;
    inactiveDays: number;
  };
  bankroll: {
    peakDeployedUsd: string;
    pnlPctOfBankroll: number | null;
    maxDrawdownPct: number | null;
  };

  // ── Bloco 2 (histórico de preço) — `available:false` quando falta cobertura ──
  peaks: {
    available: boolean;
    coveragePct: number;
    topCapturePct: number | null;
    gaveBackCount: number;
    perTrade: PerTradePeak[];
  };
  survival: {
    available: boolean;
    alivePct: number | null;
    alive: number;
    dead: number;
    unknown: number;
  };
  benchmark: {
    available: boolean;
    points: BenchmarkPoint[];
  };
}

export interface PerTradePeak {
  mint: string;
  symbol: string | null;
  exitTime: string;
  peakMultiple: number;
  exitMultiple: number;
  capturePct: number;
  tradingPnlUsd: string;
  hasData: boolean;
}

export interface BenchmarkPoint {
  date: string;
  portfolioInSol: string;
}

/**
 * GET /api/v1/analytics/portfolio — métricas do perfil. Sem `walletId` = agregado
 * de todas as carteiras; com `walletId` = escopado àquela carteira (mesmo shape).
 */
export async function getPortfolioAnalytics(
  period: MetricPeriod = "D30",
  walletId?: string | null,
): Promise<PortfolioAnalytics> {
  const { data } = await api.get<PortfolioAnalytics>("/api/v1/analytics/portfolio", {
    params: { period, ...(walletId ? { walletId } : {}) },
  });
  return data;
}
