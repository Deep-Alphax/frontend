import { api } from "@/lib/api/client";

/** Regra de monitoramento de canal do Discord (espelha o `DiscordMonitor` do backend). */
export interface FeedMonitor {
  id: string;
  name: string | null;
  /** Alvo: canal específico OU (se null) o servidor inteiro via guildId. */
  channelId: string | null;
  guildId: string | null;
  /** null/vazio = espelha TODAS as mensagens. */
  pattern: string | null;
  telegramChatId: string;
  waitForBotReply: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMonitorInput {
  name?: string;
  /** channelId (canal) OU guildId (servidor inteiro) — ao menos um. */
  channelId?: string;
  guildId?: string;
  /** Vazio/ausente = espelha tudo. */
  pattern?: string;
  telegramChatId: string;
  waitForBotReply?: boolean;
  isActive?: boolean;
}

export type UpdateMonitorInput = Partial<CreateMonitorInput>;

/** Mensagem capturada do feed. */
export interface CapturedMessage {
  id: string;
  monitorId: string | null;
  guildName: string | null;
  channelId: string;
  channelName: string | null;
  authorTag: string | null;
  matchedPattern: string | null;
  discordMessageId: string | null;
  text: string;
  embed: unknown;
  links: string[];
  sentToTelegram: boolean;
  telegramError: string | null;
  createdAt: string;
}

export interface FeedPage {
  items: CapturedMessage[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Usuário em blacklist (mensagens dele não vão ao Telegram). */
export interface BlacklistedUser {
  id: string;
  discordUserId: string | null;
  username: string | null;
  reason: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlacklistInput {
  discordUserId?: string;
  username?: string;
  reason?: string;
  isActive?: boolean;
}

export type UpdateBlacklistInput = Partial<CreateBlacklistInput>;

/** Status do self-bot (endpoint de admin). */
export interface FeedStatus {
  enabled: boolean;
  connected: boolean;
  userTag: string | null;
  telegramEnabled: boolean;
  activeMonitors: number;
  watchedChannels: number;
  watchedGuilds: number;
}

// ─────────────────────────── Status ───────────────────────────

/** GET /api/v1/feed/status — estado do self-bot (admin). */
export async function getFeedStatus(): Promise<FeedStatus> {
  const { data } = await api.get<FeedStatus>("/api/v1/feed/status");
  return data;
}

// ─────────────────────────── Monitores (CRUD, admin) ───────────────────────────

export async function getMonitors(): Promise<FeedMonitor[]> {
  const { data } = await api.get<FeedMonitor[]>("/api/v1/feed/monitors");
  return data;
}

export async function createMonitor(input: CreateMonitorInput): Promise<FeedMonitor> {
  const { data } = await api.post<FeedMonitor>("/api/v1/feed/monitors", input);
  return data;
}

export async function updateMonitor(
  id: string,
  input: UpdateMonitorInput,
): Promise<FeedMonitor> {
  const { data } = await api.patch<FeedMonitor>(`/api/v1/feed/monitors/${id}`, input);
  return data;
}

export async function deleteMonitor(id: string): Promise<{ id: string }> {
  const { data } = await api.delete<{ id: string }>(`/api/v1/feed/monitors/${id}`);
  return data;
}

// ─────────────────────────── Blacklist (CRUD, admin) ───────────────────────────

export async function getBlacklist(): Promise<BlacklistedUser[]> {
  const { data } = await api.get<BlacklistedUser[]>("/api/v1/feed/blacklist");
  return data;
}

export async function createBlacklist(input: CreateBlacklistInput): Promise<BlacklistedUser> {
  const { data } = await api.post<BlacklistedUser>("/api/v1/feed/blacklist", input);
  return data;
}

export async function updateBlacklist(
  id: string,
  input: UpdateBlacklistInput,
): Promise<BlacklistedUser> {
  const { data } = await api.patch<BlacklistedUser>(`/api/v1/feed/blacklist/${id}`, input);
  return data;
}

export async function deleteBlacklist(id: string): Promise<{ id: string }> {
  const { data } = await api.delete<{ id: string }>(`/api/v1/feed/blacklist/${id}`);
  return data;
}

// ─────────────────────────── Feed (leitura, JWT) ───────────────────────────

/** GET /api/v1/feed/messages — capturas paginadas (filtros opcionais). */
export async function getFeedMessages(params: {
  page?: number;
  limit?: number;
  channelId?: string;
  monitorId?: string;
  search?: string;
}): Promise<FeedPage> {
  const { data } = await api.get<FeedPage>("/api/v1/feed/messages", { params });
  return data;
}
