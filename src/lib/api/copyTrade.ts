import { api } from "@/lib/api/client";

/*
 * Copy Trade — espelha `backend/src/app/copy-trade/copy-trade.service.ts`.
 * Métricas de 30d medidas sobre os swaps em SOL que o Tracker captura.
 * `null` carrega significado (sem histórico, sem avatar, sem amostra).
 */

export interface CopyKolStats {
  /** % das compras avaliadas que acertaram (MC ≥2x em 24h); null = nenhuma avaliada. */
  hitRate: number | null;
  resolved: number;
  /** Resultado realizado (SOL) em 30d. */
  pnlSol: number;
  /** Resultado realizado (SOL) nas últimas 24h. */
  pnl24hSol: number;
  avgBetSol: number | null;
  /** Tempo médio entre abrir e encerrar uma posição (ms). */
  avgHoldMs: number | null;
  buys: number;
  sells: number;
  tokens: number;
}

export interface CopyKol {
  id: string;
  name: string;
  /** "@…" exibido (X, senão Telegram/Discord). */
  handle: string | null;
  relevance: number;
  types: string[];
  /** URL do avatar; null = avatar determinístico (meme pack). */
  avatarUrl: string | null;
  /** null = sem swaps em SOL nos últimos 30d. */
  stats: CopyKolStats | null;
  /** Usuários copiando agora. */
  copiers: number;
}

export interface CopyTradeHome {
  forYou: CopyKol[];
  trending: CopyKol[];
  topHit: CopyKol[];
  newInRanking: CopyKol[];
  updatedAt: string | null;
}

export type CopyTradeSort = "pnl" | "hit" | "today";

export interface CopyKolPage {
  items: CopyKol[];
  total: number;
}

export interface CopyTokenRow {
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  mcUsd: number | null;
  boughtSol: number;
  soldSol: number;
  pnlSol: number;
  lastAt: string;
  /** MC da 1ª compra do KOL no token. */
  entryMcUsd: number | null;
  /** Ele ainda segura o token. */
  open: boolean;
  holdMs: number | null;
  /** Fechado: SOL recebido ÷ posto · aberto: MC atual ÷ MC de entrada. */
  multiple: number | null;
}

export interface CopyKolDetail {
  kol: CopyKol;
  /** Resultado acumulado no fim de cada dia (30 pontos, do mais antigo a hoje). */
  series: number[];
  tokenSummary: { total: number; profitable: number; bestMultiple: number | null; open: number };
  tokens: CopyTokenRow[];
  updatedAt: string;
}

export const COPY_TRADE_KEY = ["copy-trade"] as const;

export async function getCopyTradeHome(): Promise<CopyTradeHome> {
  const { data } = await api.get<CopyTradeHome>("/api/v1/copy-trade/home");
  return data;
}

export async function getCopyKols(p: {
  sort: CopyTradeSort;
  q?: string;
  offset: number;
  limit: number;
}): Promise<CopyKolPage> {
  const { data } = await api.get<CopyKolPage>("/api/v1/copy-trade/kols", {
    params: { sort: p.sort, offset: p.offset, limit: p.limit, ...(p.q ? { q: p.q } : {}) },
  });
  return data;
}

export async function getCopyKol(kolId: string): Promise<CopyKolDetail> {
  const { data } = await api.get<CopyKolDetail>(
    `/api/v1/copy-trade/kols/${encodeURIComponent(kolId)}`,
  );
  return data;
}

// ───────────────────────── Copies do usuário (execução) ─────────────────────────

export type ExecMode = "off" | "shadow" | "live";
export type CopyStatus = "ACTIVE" | "PAUSED" | "STOPPED" | "ENDED";
export type CopyDecision = "PENDING" | "EXECUTING" | "COPIED" | "IGNORED" | "NOT_COPIED" | "FAILED" | "SHADOW";

/** Espelha `backend/src/app/copy-trade/engine/copy-config.ts`. */
export interface CopyTarget {
  kind: "profit" | "loss";
  atPct: number;
  sellPct: number;
}

export interface CopyConfig {
  v: 1;
  buy: { mode: "match" | "fixed" | "percent"; amountSol: number; percent: number };
  sell: { mode: "follow" | "targets" | "none"; targets: CopyTarget[] };
  protection: {
    minDeepScore: number | null;
    skipIfDevSold: boolean;
    maxBundlePct: number | null;
    pauseOnLossPct24h: number | null;
  };
  filters: {
    mcMinUsd: number | null;
    mcMaxUsd: number | null;
    liqMinUsd: number | null;
    maxBuysPerDay: number | null;
    oncePerToken: boolean;
  };
  execution: { priorityFeeSol: number; antiMev: boolean; slippageBps: number };
}

export interface KolRef {
  id: string;
  label: string;
  relevance: number;
  avatarUrl: string | null;
}

export interface CopyView {
  id: string;
  kol: KolRef;
  status: CopyStatus;
  stopReason: "LOW_BALANCE" | "LOSS_LIMIT" | null;
  statusAt: string;
  createdAt: string;
  endedAt: string | null;
  config: CopyConfig;
  /** null = posição aberta sem preço agora. */
  resultSol: number | null;
  resultPct: number | null;
  todaySol: number;
  trades: number;
  open: number;
}

export interface W1Info {
  address: string;
  balanceSol: number | null;
  createdAt: string;
}

export interface CopyOverview {
  /** "shadow" = tudo SIMULADO — a tela tem que dizer. */
  mode: ExecMode;
  w1: W1Info | null;
  summary: { resultSol: number; resultPct: number | null; todaySol: number; spark: number[] };
  active: CopyView[];
  history: CopyView[];
}

export interface CopyFeedItem {
  id: string;
  at: string;
  kol: KolRef;
  side: "BUY" | "SELL";
  token: { mint: string; symbol: string | null };
  kolQuoteSol: number | null;
  kolMcUsd: number | null;
  kolMultiple: number | null;
  decision: CopyDecision;
  reason: string | null;
  planSol: number | null;
  filledSol: number | null;
  pnlSol: number | null;
}

export interface CopyFeedPage {
  items: CopyFeedItem[];
  total: number;
  page: number;
}

export interface CopyEventRef {
  sourceId: string;
  side: "BUY" | "SELL";
  decision: CopyDecision;
  reason: string | null;
  planSol: number | null;
  filledSol: number | null;
  pnlSol: number | null;
  at: string;
}

export interface KolCopy {
  mode: ExecMode;
  copy: CopyView | null;
  events: CopyEventRef[];
}

export interface CopiersBoard {
  count: number;
  avgResultPct: number | null;
  profitable: number;
  losing: number;
  tip: { minDeepScore: number; deltaPct: number } | null;
  me: {
    rank: number;
    sinceDays: number;
    amountSol: number;
    buyMode: string;
    resultSol: number | null;
    resultPct: number | null;
  } | null;
  page: number;
  rows: Array<{ rank: number; alias: string; mine: boolean; sinceDays: number; resultPct: number | null }>;
}

export interface W1State {
  enabled: boolean;
  wallet: W1Info | null;
  addresses: Array<{ id: string; address: string; label: string; activeAt: string; active: boolean }>;
  withdrawals: Array<{
    id: string;
    toAddress: string;
    amountSol: number;
    status: "PENDING" | "EXECUTING" | "SENT" | "FAILED";
    txSignature: string | null;
    error: string | null;
    createdAt: string;
    sentAt: string | null;
  }>;
}

const ME = "/api/v1/copy-trade/me";
const W1 = "/api/v1/copy-trade/w1";

export const getCopyOverview = async () => (await api.get<CopyOverview>(ME)).data;
export const getCopyFeed = async (page: number, pageSize = 10) =>
  (await api.get<CopyFeedPage>(`${ME}/feed`, { params: { page, pageSize } })).data;
export const getKolCopy = async (kolId: string) =>
  (await api.get<KolCopy>(`${ME}/kols/${encodeURIComponent(kolId)}`)).data;
export const getCopiers = async (kolId: string, page: number, pageSize = 10) =>
  (await api.get<CopiersBoard>(`${ME}/kols/${encodeURIComponent(kolId)}/copiers`, { params: { page, pageSize } })).data;
/** Prévia da carteira colada no "Novo Wallet Copy" (Figma 1642:34085). */
export interface ResolvedWallet {
  address: string;
  /** KOL do índice dono da carteira; null = carteira avulsa ("Sem perfil de KOL"). */
  kol: KolRef | null;
  /** 30d da carteira; null = nenhum swap em SOL no período (ou histórico indisponível). */
  stats: {
    /** Só conta swaps ao vivo (o histórico on-chain não tem o MC da época). */
    hitRate: number | null;
    pnlSol: number;
    trades: number;
    /** Histórico cortado no teto da busca: `trades` é um piso ("1,000+"). */
    partial: boolean;
  } | null;
}

export const resolveCopyAddress = async (address: string) =>
  (await api.get<ResolvedWallet>(`${ME}/resolve`, { params: { address } })).data;

export const createCopy = async (body: { kolId?: string; address?: string; config: CopyConfig }) =>
  (await api.post<CopyView>(`${ME}/copies`, body)).data;
export const updateCopy = async (copyId: string, config: CopyConfig) =>
  (await api.patch<CopyView>(`${ME}/copies/${encodeURIComponent(copyId)}`, { config })).data;
export const copyAction = async (copyId: string, action: "pause" | "resume" | "end") =>
  (await api.post<CopyView>(`${ME}/copies/${encodeURIComponent(copyId)}/${action}`)).data;

export const getW1 = async () => (await api.get<W1State>(W1)).data;
export const requestAddressCode = async (address: string) => (await api.post(`${W1}/addresses/code`, { address })).data;
export const confirmAddress = async (address: string, code: string, label?: string) =>
  (await api.post(`${W1}/addresses`, { address, code, label })).data;
export const removeAddress = async (id: string) => (await api.delete(`${W1}/addresses/${encodeURIComponent(id)}`)).data;
export const requestWithdrawCode = async (address: string, amountSol: number) =>
  (await api.post(`${W1}/withdraw/code`, { address, amountSol })).data;
export const confirmWithdraw = async (address: string, amountSol: number, code: string) =>
  (await api.post(`${W1}/withdraw`, { address, amountSol, code })).data;
