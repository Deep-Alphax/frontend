import { api } from "@/lib/api/client";
import type { KolState, ScanResult, ScanSummary, WalletRef } from "@/lib/walletReader/types";

/*
 * KOL Index — espelha os DTOs de `backend/src/app/wallet-reader/*`.
 *
 * Duas camadas: o PRESET global (todo usuário vê, só ADMIN escreve) e o
 * OVERRIDE da conta (só o dono vê e escreve). O merge é feito no cliente
 * (`useKolIndex`), para a UI conseguir distinguir "herdado do preset" de
 * "editado por mim".
 */

/** Um KOL do preset global. */
export interface KolPresetEntry {
  id: string;
  name: string;
  wallets: WalletRef[];
  squads: string[];
  relevance: number;
  types: string[];
  twitter: string;
  notes: string;
  avatar: string | null;
}

/** O preset como o admin vê (inclui os removidos). */
export interface KolPresetAdminEntry extends KolPresetEntry {
  deletedAt: number | null;
}

/** Linha da lista de admin — sem os endereços, só a contagem. */
export type KolPresetListItem = Omit<KolPresetAdminEntry, "wallets"> & {
  walletCount: number;
};

/** O que o usuário mudou num KOL. `null` = herda o campo do preset. */
export interface KolOverrideEntry {
  kolId: string;
  name: string | null;
  relevance: number | null;
  types: string[] | null;
  fnfGroups: string[] | null;
  twitter: string | null;
  notes: string | null;
  /** `null` = herda; `""` = o usuário limpou o avatar do preset. */
  avatar: string | null;
  walletsAdded: WalletRef[] | null;
  walletsRemoved: string[] | null;
  dismissedSidewallets: string[] | null;
  isCustom: boolean;
  deleted: boolean;
  updatedAt: number;
}

export interface KolGroup {
  id: string;
  name: string;
}

/** Item da lista — o estado efetivo SEM as carteiras (o card só usa a contagem). */
export type KolListItem = Omit<KolState, "wallets">;

/** Parâmetros da consulta ao índice — filtro e paginação são do servidor. */
export interface KolIndexParams {
  search?: string;
  view?: "all" | "unclassified" | "alphaUp" | "noTwitter" | "pendingScan";
  tiers?: string[];
  types?: string[];
  squads?: string[];
  groups?: string[];
  sort?: "relevance" | "name" | "wallets" | "tier";
  limit?: number;
  offset?: number;
}

/** Uma página do índice + tudo que a rail precisa. */
export interface KolIndexPage {
  items: KolListItem[];
  total: number;
  counts: {
    byTier: Record<string, number>;
    byType: Record<string, number>;
    bySquad: Record<string, number>;
    byGroup: Record<string, number>;
  };
  viewCounts: Record<string, number>;
  squads: string[];
  groups: KolGroup[];
}

/**
 * Patch do override. Chave AUSENTE = não mexe; `null` = volta a herdar do
 * preset. É a mesma convenção do backend — não "normalize" null para undefined.
 */
export type KolOverridePatch = Partial<
  Pick<
    KolOverrideEntry,
    | "name"
    | "relevance"
    | "types"
    | "fnfGroups"
    | "twitter"
    | "notes"
    | "avatar"
    | "walletsAdded"
    | "walletsRemoved"
    | "dismissedSidewallets"
  > & {
    deleted: boolean;
    /** Lista EFETIVA desejada — o servidor deriva added/removed contra o preset. */
    wallets: WalletRef[];
  }
>;

/** Campos do preset que o admin edita. */
export type KolPresetPatch = Partial<
  Pick<
    KolPresetEntry,
    "name" | "wallets" | "squads" | "relevance" | "types" | "twitter" | "notes" | "avatar"
  >
>;

// ── Usuário logado ───────────────────────────────────────────────────────────

/** Listas viajam como "a,b,c"; vazio some da query. */
function listParam(v?: string[]): string | undefined {
  return v && v.length ? v.join(",") : undefined;
}

/** GET /api/v1/wallet-reader/kols — UMA página, já mesclada e filtrada. */
export async function getKolIndex(params: KolIndexParams = {}): Promise<KolIndexPage> {
  const { data } = await api.get<KolIndexPage>("/api/v1/wallet-reader/kols", {
    params: {
      search: params.search || undefined,
      view: params.view && params.view !== "all" ? params.view : undefined,
      tiers: listParam(params.tiers),
      types: listParam(params.types),
      squads: listParam(params.squads),
      groups: listParam(params.groups),
      sort: params.sort,
      limit: params.limit,
      offset: params.offset,
    },
  });
  return data;
}

/** GET /api/v1/wallet-reader/kols/:kolId — estado efetivo COM as carteiras. */
export async function getKol(kolId: string): Promise<KolState> {
  const { data } = await api.get<KolState>(
    `/api/v1/wallet-reader/kols/${encodeURIComponent(kolId)}`,
  );
  return data;
}

/** PATCH /api/v1/wallet-reader/kols/:kolId — salva as edições da conta. */
export async function patchKolOverride(
  kolId: string,
  patch: KolOverridePatch,
): Promise<KolOverrideEntry> {
  const { data } = await api.patch<KolOverrideEntry>(
    `/api/v1/wallet-reader/kols/${encodeURIComponent(kolId)}`,
    patch,
  );
  return data;
}

/** DELETE /api/v1/wallet-reader/kols/:kolId — descarta as edições da conta. */
export async function deleteKolOverride(kolId: string): Promise<void> {
  await api.delete(`/api/v1/wallet-reader/kols/${encodeURIComponent(kolId)}`);
}

/** POST /api/v1/wallet-reader/kols — cria um KOL só na conta do usuário. */
export async function createCustomKol(input: {
  name: string;
  wallet?: WalletRef;
}): Promise<KolOverrideEntry> {
  const { data } = await api.post<KolOverrideEntry>("/api/v1/wallet-reader/kols", input);
  return data;
}

/** GET /api/v1/wallet-reader/kols/backup — backup das edições da conta. */
export async function exportKolBackup(): Promise<{
  version: 1;
  exportedAt: string;
  overrides: Record<string, KolOverridePatch>;
  customIds: string[];
  groups: KolGroup[];
}> {
  const { data } = await api.get("/api/v1/wallet-reader/kols/backup");
  return data;
}

/** DELETE /api/v1/wallet-reader/kols — apaga TODAS as edições da conta. */
export async function resetKolAccount(): Promise<void> {
  await api.delete("/api/v1/wallet-reader/kols");
}

/** POST /api/v1/wallet-reader/kols/import — restaura um backup (1 chamada). */
export async function importKolBackup(input: {
  overrides: (KolOverridePatch & { kolId: string })[];
  groups: KolGroup[];
}): Promise<{ imported: number; groups: KolGroup[] }> {
  const { data } = await api.post<{ imported: number; groups: KolGroup[] }>(
    "/api/v1/wallet-reader/kols/import",
    input,
  );
  return data;
}

// ── Grupos / FnFs da conta ───────────────────────────────────────────────────

/** POST /api/v1/wallet-reader/groups — idempotente por nome. */
export async function createKolGroup(name: string): Promise<KolGroup> {
  const { data } = await api.post<KolGroup>("/api/v1/wallet-reader/groups", { name });
  return data;
}

/** PATCH /api/v1/wallet-reader/groups/:id */
export async function renameKolGroup(id: string, name: string): Promise<KolGroup> {
  const { data } = await api.patch<KolGroup>(`/api/v1/wallet-reader/groups/${id}`, { name });
  return data;
}

/** DELETE /api/v1/wallet-reader/groups/:id — desvincula dos KOLs também. */
export async function deleteKolGroup(id: string): Promise<void> {
  await api.delete(`/api/v1/wallet-reader/groups/${id}`);
}

// ── Preset global (ADMIN) ────────────────────────────────────────────────────

/** Uma página do preset como o admin vê. */
export interface KolPresetAdminPage {
  items: KolPresetListItem[];
  total: number;
}

/**
 * GET /api/v1/wallet-reader/admin/kols — UMA página do preset (com os removidos).
 * A busca roda no banco; por nome ela usa o índice trgm de `KolPreset.name`.
 */
export async function getKolPresetAdmin(params: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<KolPresetAdminPage> {
  const { data } = await api.get<KolPresetAdminPage>("/api/v1/wallet-reader/admin/kols", {
    params: {
      search: params.search || undefined,
      limit: params.limit,
      offset: params.offset,
    },
  });
  return data;
}

/** GET /api/v1/wallet-reader/admin/kols/:id — o KOL COM as carteiras (editor). */
export async function getKolPresetOne(id: string): Promise<KolPresetAdminEntry> {
  const { data } = await api.get<KolPresetAdminEntry>(
    `/api/v1/wallet-reader/admin/kols/${encodeURIComponent(id)}`,
  );
  return data;
}

/** POST /api/v1/wallet-reader/admin/kols — adiciona ao preset (todos veem). */
export async function createKolPreset(
  input: KolPresetPatch & { name: string },
): Promise<KolPresetEntry> {
  const { data } = await api.post<KolPresetEntry>("/api/v1/wallet-reader/admin/kols", input);
  return data;
}

/** PATCH /api/v1/wallet-reader/admin/kols/:id */
export async function updateKolPreset(
  id: string,
  patch: KolPresetPatch,
): Promise<KolPresetEntry> {
  const { data } = await api.patch<KolPresetEntry>(
    `/api/v1/wallet-reader/admin/kols/${encodeURIComponent(id)}`,
    patch,
  );
  return data;
}

/** DELETE /api/v1/wallet-reader/admin/kols/:id — soft delete no preset. */
export async function deleteKolPreset(id: string): Promise<void> {
  await api.delete(`/api/v1/wallet-reader/admin/kols/${encodeURIComponent(id)}`);
}

/** POST /api/v1/wallet-reader/admin/kols/:id/restore */
export async function restoreKolPreset(id: string): Promise<void> {
  await api.post(`/api/v1/wallet-reader/admin/kols/${encodeURIComponent(id)}/restore`);
}

// ── Varredura de sidewallets ─────────────────────────────────────────────────

/** GET /api/v1/wallet-reader/scans — RESUMO de todos (sem as evidências). */
export async function getScans(): Promise<Record<string, ScanSummary>> {
  const { data } = await api.get<{ scans?: Record<string, ScanSummary> }>(
    "/api/v1/wallet-reader/scans",
  );
  return data.scans ?? {};
}

/**
 * GET /api/v1/wallet-reader/scans/:kolId — as varreduras do KOL, uma por
 * carteira já varrida, com as evidências. Sob demanda (o modal abriu).
 */
export async function getScansOf(kolId: string): Promise<ScanResult[]> {
  const { data } = await api.get<ScanResult[]>(
    `/api/v1/wallet-reader/scans/${encodeURIComponent(kolId)}`,
  );
  return data;
}

/**
 * POST /api/v1/wallet-reader/scan/:kolId — varre UMA carteira do KOL.
 *
 * `wallet` é o endereço escolhido (sem ele, a primeira do KOL). Responde NA
 * HORA: devolve o scan em cache se ainda vale, senão volta como `queued` e o
 * resultado chega depois pelo socket (`scan:update`).
 */
export async function requestScan(
  kolId: string,
  wallet?: string,
  force = false,
): Promise<ScanResult> {
  const { data } = await api.post<ScanResult>(
    `/api/v1/wallet-reader/scan/${encodeURIComponent(kolId)}`,
    undefined,
    { params: { wallet: wallet || undefined, force: force ? 1 : undefined } },
  );
  return data;
}
