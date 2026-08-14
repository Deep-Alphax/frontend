import { api } from "@/lib/api/client";
import type { MetricPeriod } from "@/lib/api/analytics";
import type { TradeSource } from "@/lib/analytics/sources";
import type { BackendChain } from "@/lib/api/wallets";

/** Carteira on-chain de uma fonte (endereço público que o usuário segue). */
export interface SourceWallet {
  id: string;
  chain: BackendChain;
  address: string;
  label: string | null;
  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "ERROR";
}

/** Fonte de alpha do usuário (desk/grupo), representada por 1+ carteiras. */
export interface Source {
  id: string;
  name: string;
  isActive: boolean;
  attributionWindowHours: number;
  wallets: SourceWallet[];
}

/** GET /api/v1/sources — fontes do usuário (com suas carteiras). */
export async function getSources(): Promise<Source[]> {
  const { data } = await api.get<Source[]>("/api/v1/sources");
  return data;
}

/** POST /api/v1/sources — cria uma fonte. 409 = nome já usado. */
export async function createSource(input: {
  name: string;
  attributionWindowHours?: number;
}): Promise<Source> {
  const { data } = await api.post<Source>("/api/v1/sources", input);
  return data;
}

/** DELETE /api/v1/sources/:id — remove a fonte (e suas carteiras/atribuições). */
export async function deleteSource(id: string): Promise<void> {
  await api.delete(`/api/v1/sources/${id}`);
}

/** POST /api/v1/sources/:id/wallets — adiciona uma carteira on-chain à fonte. */
export async function addSourceWallet(
  sourceId: string,
  input: { chain: BackendChain; address: string; label?: string },
): Promise<SourceWallet> {
  const { data } = await api.post<SourceWallet>(`/api/v1/sources/${sourceId}/wallets`, input);
  return data;
}

/** DELETE /api/v1/sources/:id/wallets/:walletId — remove uma carteira da fonte. */
export async function removeSourceWallet(sourceId: string, walletId: string): Promise<void> {
  await api.delete(`/api/v1/sources/${sourceId}/wallets/${walletId}`);
}

/**
 * GET /api/v1/analytics/sources — breakdown "De onde vieram os trades" por fonte
 * de alpha (atribuição lead-lag no backend). Retorna o array direto (sem `{ data }`).
 * Fontes sem trades atribuídos vêm zeradas; capture pode ser null (sem cobertura de candles).
 */
export async function getSourcesAnalytics(
  period: MetricPeriod = "D30",
  walletId?: string | null,
): Promise<TradeSource[]> {
  const { data } = await api.get<TradeSource[]>("/api/v1/analytics/sources", {
    params: { period, ...(walletId ? { walletId } : {}) },
  });
  return data;
}

/**
 * GET /api/v1/analytics/discord-sources — "De onde vieram os trades" cruzando os
 * trades com as calls dos grupos do Discord (atribuição por servidor via CA/ticker).
 * `walletId` escopa à carteira selecionada (como as outras tabs); sem ele = agregado.
 */
export async function getDiscordSourcesAnalytics(
  period: MetricPeriod = "D30",
  walletId?: string | null,
): Promise<TradeSource[]> {
  const { data } = await api.get<TradeSource[]>(
    "/api/v1/analytics/discord-sources",
    { params: { period, ...(walletId ? { walletId } : {}) } },
  );
  return data;
}
