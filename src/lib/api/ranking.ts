import { api } from "@/lib/api/client";

/*
 * Deep Ranking — espelha `backend/src/app/ranking/ranking.service.ts`.
 * `null` carrega significado (sem variação, sem prêmio, sem temporada).
 */

export type SeasonStatus = "active" | "upcoming" | "ended";

export interface RankingSeason {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: SeasonStatus;
}

export interface RankingRow {
  position: number;
  /** >0 subiu, <0 caiu desde 00:00 UTC; null = sem base de comparação. */
  change: number | null;
  kol: {
    id: string;
    name: string;
    handle: string | null;
    /** Handle do X validado no servidor (vira link); null = sem X. */
    x: string | null;
    relevance: number;
  };
  points: number;
  calls: number;
  /** % de calls com acerto (0–100). */
  accuracy: number;
  /** USD; null = posição sem prêmio. */
  prize: number | null;
}

export interface RankingOverview {
  season: RankingSeason | null;
  podium: RankingRow[];
  total: number;
  updatedAt: string | null;
}

export interface RankingStandings {
  rows: RankingRow[];
  total: number;
}

export const RANKING_KEY = ["ranking"] as const;

export async function getRankingOverview(): Promise<RankingOverview> {
  const { data } = await api.get<RankingOverview>("/api/v1/ranking");
  return data;
}

export async function getRankingStandings(p: {
  offset: number;
  limit: number;
  q?: string;
}): Promise<RankingStandings> {
  const { data } = await api.get<RankingStandings>("/api/v1/ranking/standings", {
    params: { offset: p.offset, limit: p.limit, ...(p.q ? { q: p.q } : {}) },
  });
  return data;
}

// ─────────────────────────────── Admin ───────────────────────────────

export interface AdminRankingSeason {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  /** `prizes[i]` = prêmio em USD da posição i+1. */
  prizes: number[];
  /** KOLs na classificação. */
  kols: number;
}

export interface RankingSeasonInput {
  name: string;
  startsAt: string;
  endsAt: string;
  prizes: number[];
}

export const RANKING_ADMIN_KEY = ["ranking", "admin", "seasons"] as const;

export async function listRankingSeasons(): Promise<AdminRankingSeason[]> {
  const { data } = await api.get<AdminRankingSeason[]>("/api/v1/ranking/admin/seasons");
  return data;
}

export async function createRankingSeason(input: RankingSeasonInput) {
  const { data } = await api.post("/api/v1/ranking/admin/seasons", input);
  return data;
}

export async function updateRankingSeason(id: string, input: RankingSeasonInput) {
  const { data } = await api.patch(
    `/api/v1/ranking/admin/seasons/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

export async function deleteRankingSeason(id: string) {
  await api.delete(`/api/v1/ranking/admin/seasons/${encodeURIComponent(id)}`);
}
