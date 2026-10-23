import { api } from "@/lib/api/client";
import type { ExecMode, W1Info } from "@/lib/api/copyTrade";

/*
 * Dev Snipe (Figma 1633:33457 home, 1646:36228/1646:36614 drawer, 1661:42194
 * tipos de regra): compra o próximo token que a carteira de um dev lançar na
 * pump.fun e vende pelas regras do usuário. Espelha
 * `backend/src/app/copy-trade/snipe/snipe-config.ts` e os DTOs do controller.
 */

/** Uma regra de venda ("Minhas regras"). Percentuais em pontos (50 = 50%). */
export type SnipeRule =
  /** Lucro: vende `sellPct` quando o preço sobe `atPct` acima da entrada. */
  | { kind: "tp"; atPct: number; sellPct: number }
  /** Perda: vende `sellPct` quando o preço cai a `atPct` (negativo) da entrada. */
  | { kind: "sl"; atPct: number; sellPct: number }
  /** Trailing de lucro: em lucro, acompanha o topo e vende se recuar `pullbackPct`. */
  | { kind: "trail_tp"; pullbackPct: number; sellPct: number }
  /** Trailing de perda: vende se cair `dropPct` do maior preço desde a compra. */
  | { kind: "trail_sl"; dropPct: number; sellPct: number }
  /** Atraso: AJUSTE GERAL (no máximo um) — toda venda espera entre `minS` e `maxS` segundos. */
  | { kind: "delay"; minS: number; maxS: number }
  /** Vende `sellPct` assim que a carteira do dev vender o token. */
  | { kind: "dev_sold"; sellPct: number }
  /** Vende `sellPct` quando o token sai da bonding curve (migração). */
  | { kind: "migrated"; sellPct: number };

export type SnipeRuleKind = SnipeRule["kind"];

export interface SnipeConfig {
  v: 1;
  /** "Valor por snipe" (SOL) — comprado em cada token novo do dev. */
  amountSol: number;
  /** Acordeão "Snipes": para depois de N tokens; null = sem limite. */
  maxTokens: number | null;
  sell: { mode: "none" | "rules"; rules: SnipeRule[] };
  /** Acordeão "Execução": slippage null = automático. */
  execution: { slippageBps: number | null; priorityFeeSol: number; antiMev: boolean };
}

/** Histórico do dev na pump.fun (só o que o Deep Alpha indexou, mais o backfill). */
export interface DevStats {
  tokens: number;
  migrated: number;
  /** % dos tokens dos últimos 30 dias que migraram (0–100); null = nenhum token em 30 dias. */
  migrationRate: number | null;
  /** Maior pico ÷ MC de lançamento; null = nenhum pico conhecido. */
  bestMultiple: number | null;
  lastLaunchAt: string | null;
  /** Últimos lançamentos (até 12), do MAIS ANTIGO ao mais novo: migrou? */
  recent: boolean[];
}

/** Card "Devs em alta". */
export interface DevCard {
  address: string;
  stats: DevStats;
}

/** Prévia do dev colado no drawer ("dev encontrado"). */
export interface DevPreview {
  address: string;
  /** null = a carteira nunca lançou token na pump.fun (que a gente saiba). */
  stats: DevStats | null;
}

export type SnipeStatus = "ACTIVE" | "PAUSED" | "DONE" | "ENDED";

export interface SnipeView {
  id: string;
  dev: string;
  /** "DEVx…k3Pa". */
  label: string;
  status: SnipeStatus;
  config: SnipeConfig;
  /** Tokens já snipados (o "1 de 3"). */
  sniped: number;
  /** Resultado realizado + aberto (SOL); null = posição aberta sem preço agora. */
  resultSol: number | null;
  createdAt: string;
}

/** Um disparo (token comprado por um snipe) — grupo "Disparados". */
export interface SnipeFire {
  snipeId: string;
  dev: string;
  label: string;
  mint: string;
  symbol: string | null;
  /** Resultado do token (SOL); null = sem preço agora. */
  resultSol: number | null;
  /** Valor atual (ou recebido) ÷ custo; null = sem preço. */
  multiple: number | null;
  open: boolean;
  at: string;
}

export interface SnipeOverview {
  /** "shadow" = tudo SIMULADO — a tela tem que dizer. */
  mode: ExecMode;
  w1: W1Info | null;
  /** Snipes esperando o próximo lançamento (ativos/pausados e abaixo do limite). */
  waiting: SnipeView[];
  /** Últimos disparos, mais novo primeiro (até 20). */
  fired: SnipeFire[];
}

export interface LaunchRow {
  mint: string;
  symbol: string | null;
  name: string | null;
  dev: string;
  devLabel: string;
  createdAt: string;
  /** MC atual em USD; null = desconhecido. */
  mcUsd: number | null;
  devHistory: { migrated: number; tokens: number };
  /** Quantos snipes compraram este token (todos os usuários). */
  snipes: number;
  /** O usuário atual comprou ("Você comprou"). */
  mine: boolean;
}

export interface LaunchPage {
  items: LaunchRow[];
  total: number;
  page: number;
}

export const SNIPE_KEY = ["dev-snipe"] as const;
const BASE = "/api/v1/copy-trade/snipe";

export const getSnipeOverview = async () => (await api.get<SnipeOverview>(`${BASE}/me`)).data;
export const getTrendingDevs = async () => (await api.get<{ items: DevCard[] }>(`${BASE}/devs`)).data.items;
export const getLaunches = async (page: number, pageSize = 10) =>
  (await api.get<LaunchPage>(`${BASE}/launches`, { params: { page, pageSize } })).data;
export const resolveDev = async (address: string) =>
  (await api.get<DevPreview>(`${BASE}/resolve`, { params: { address } })).data;
export const createSnipe = async (body: { dev: string; config: SnipeConfig }) =>
  (await api.post<SnipeView>(`${BASE}/snipes`, body)).data;
export const updateSnipe = async (id: string, config: SnipeConfig) =>
  (await api.patch<SnipeView>(`${BASE}/snipes/${encodeURIComponent(id)}`, { config })).data;
export const snipeAction = async (id: string, action: "pause" | "resume" | "end") =>
  (await api.post<SnipeView>(`${BASE}/snipes/${encodeURIComponent(id)}/${action}`)).data;
