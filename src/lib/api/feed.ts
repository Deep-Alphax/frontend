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
  /** ID do autor no Discord (snowflake) — identidade estável p/ perfil/favoritos. */
  authorId: string | null;
  /**
   * Papel do autor no radar → badge do card (ex.: "call_owner", "scan",
   * "copytrader", "sniper"). Código estável mapeado no front por `roleBadge.tsx`;
   * `null`/ausente = sem badge. Papéis desconhecidos caem no estilo neutro.
   */
  role?: string | null;
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
  /** Snowflake do autor (identidade estável, parcial no histórico). */
  authorId?: string;
  /** Tag do autor (identidade presente em 100% das capturas) — feed do perfil. */
  authorTag?: string;
  search?: string;
}): Promise<FeedPage> {
  const { data } = await api.get<FeedPage>("/api/v1/feed/messages", { params });
  return data;
}

// ─────────────────────────── Grupos + subgrupos (árvore) ─────────────────────

/** Subgrupo (canal) com contagem total real (agregada no backend). */
export interface FeedChannel {
  channelId: string;
  channelName: string | null;
  count: number;
}

/** Grupo (servidor) com seus canais e contagens totais reais. */
export interface FeedGroup {
  guildName: string | null;
  /** URL do ícone do servidor (CDN do Discord); null quando não capturado. */
  guildIconUrl: string | null;
  count: number;
  channels: FeedChannel[];
}

/**
 * GET /api/v1/feed/groups — árvore grupos→canais com contagens totais,
 * independente do que já foi rolado no feed (agregação no banco).
 */
export async function getFeedGroups(): Promise<FeedGroup[]> {
  const { data } = await api.get<FeedGroup[]>("/api/v1/feed/groups");
  return data;
}

// ─────────────────────────── Stats de autor (perfil) ─────────────────────────

/** Estatísticas do perfil de um autor. */
export interface AuthorStats {
  authorTag: string;
  messages: number;
  tokens: number;
  /** ISO da primeira captura (idade "no radar"); null se desconhecido. */
  firstSeenAt: string | null;
}

/** GET /api/v1/feed/author-stats?authorTag= */
export async function getAuthorStats(authorTag: string): Promise<AuthorStats> {
  const { data } = await api.get<AuthorStats>("/api/v1/feed/author-stats", {
    params: { authorTag },
  });
  return data;
}

// ────────────── Favoritos / personalização de autores (por conta, JWT) ───────

/**
 * Autor do Discord seguido E/OU personalizado pela conta. A linha existe pelos
 * dois motivos, independentes: `followed=false` é só personalização (apelido,
 * cor, foto) — pinta os cards, mas fica fora da lista/feed de favoritos.
 */
export interface FavoriteAuthor {
  id: string;
  authorId: string;
  authorTag: string | null;
  /** `false` = só personalizado (o usuário não segue este autor). */
  followed: boolean;
  /** Apelido dado pelo usuário (sobrepõe o nome exibido). */
  nickname: string | null;
  /** Chave de cor do avatar (allowlist); null = cor por hash. */
  color: string | null;
  /** URL absoluta da foto re-hospedada; null quando não há foto. */
  photoUrl: string | null;
  createdAt: string;
}

/** Personalização enviada ao backend (campos ausentes não mudam). */
export interface UpdateFavoriteInput {
  nickname?: string | null;
  color?: string | null;
  /** Tag do autor — usada só quando a linha é criada por este PATCH. */
  authorTag?: string;
}

/** GET /api/v1/feed/favorites — autores seguidos. */
export async function getFavorites(): Promise<FavoriteAuthor[]> {
  const { data } = await api.get<FavoriteAuthor[]>("/api/v1/feed/favorites");
  return data;
}

/** POST /api/v1/feed/favorites — segue (idempotente). */
export async function addFavorite(input: {
  authorId: string;
  authorTag?: string | null;
}): Promise<FavoriteAuthor> {
  const { data } = await api.post<FavoriteAuthor>("/api/v1/feed/favorites", input);
  return data;
}

/** DELETE /api/v1/feed/favorites/:authorId — deixa de seguir. */
export async function removeFavorite(authorId: string): Promise<{ authorId: string }> {
  const { data } = await api.delete<{ authorId: string }>(
    `/api/v1/feed/favorites/${encodeURIComponent(authorId)}`,
  );
  return data;
}

/** PATCH /api/v1/feed/favorites/:authorId — personaliza (não exige seguir). */
export async function updateFavorite(
  authorId: string,
  input: UpdateFavoriteInput,
): Promise<FavoriteAuthor> {
  const { data } = await api.patch<FavoriteAuthor>(
    `/api/v1/feed/favorites/${encodeURIComponent(authorId)}`,
    input,
  );
  return data;
}

/** POST /api/v1/feed/favorites/:authorId/photo — envia a foto do avatar. */
export async function uploadFavoritePhoto(
  authorId: string,
  file: File,
): Promise<FavoriteAuthor> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<FavoriteAuthor>(
    `/api/v1/feed/favorites/${encodeURIComponent(authorId)}/photo`,
    form,
    // Remove o default `application/json` da instância: assim o browser define
    // `multipart/form-data` com o boundary correto (senão o multer não lê o arquivo).
    { headers: { "Content-Type": undefined } },
  );
  return data;
}

/** GET /api/v1/feed/favorites/messages — feed paginado dos autores seguidos. */
export async function getFavoriteMessages(params: {
  page?: number;
  limit?: number;
}): Promise<FeedPage> {
  const { data } = await api.get<FeedPage>("/api/v1/feed/favorites/messages", {
    params,
  });
  return data;
}
