import type { RankingSeason } from "@/lib/api/ranking";
import { hashStr } from "@/lib/walletReader/types";

/*
 * Regras de exibição do Deep Ranking. Os números de pontuação ESPELHAM
 * `backend/src/app/ranking/ranking.rules.ts` (fonte da verdade): servem só ao
 * texto do "How it works".
 */

export const POINTS_TABLE: ReadonlyArray<{ min: number; points: number }> = [
  { min: 10, points: 600 },
  { min: 5, points: 300 },
  { min: 3, points: 180 },
  { min: 2, points: 100 },
  { min: 1.5, points: 30 },
];
export const MISS_POINTS = -20;

export interface Countdown {
  days: string;
  hours: string;
  min: string;
  sec: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Tempo até `target` em dias/horas/min/seg com 2 dígitos (nunca negativo). */
export function countdown(target: Date, now: Date): Countdown {
  const s = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  return {
    days: pad(Math.floor(s / 86_400)),
    hours: pad(Math.floor((s % 86_400) / 3_600)),
    min: pad(Math.floor((s % 3_600) / 60)),
    sec: pad(s % 60),
  };
}

/** O que o contador mede e o rótulo ao lado dele. null = sem contador. */
export function seasonClock(season: RankingSeason): { label: string; target: Date } | null {
  if (season.status === "active") return { label: `${season.name} ends in`, target: new Date(season.endsAt) };
  if (season.status === "upcoming") return { label: `${season.name} starts in`, target: new Date(season.startsAt) };
  return null;
}

export const fmtPoints = (n: number) => n.toLocaleString("en-US");
export const fmtPrize = (usd: number) => `$${usd.toLocaleString("en-US")}`;

/** Iniciais do avatar: 1ª letra das duas primeiras palavras, ou 2 letras do nome. */
export function initials(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0] ?? "?").slice(0, 2).toUpperCase();
}

/**
 * Degradês do avatar de iniciais (Figma 1464:13573): claro → médio da mesma
 * família, a 135°. Escolha determinística pelo id do KOL.
 */
const AVATAR_SKINS = [
  "from-secundaria-12 to-secundaria-9",
  "from-vermelho-12 to-vermelho-9",
  "from-menta-12 to-menta-7",
  "from-violeta-12 to-violeta-9",
  "from-principal-12 to-principal-9",
  "from-green-12 to-green-9",
] as const;

export function avatarSkin(id: string): string {
  return AVATAR_SKINS[hashStr(id) % AVATAR_SKINS.length];
}

/** Largura da barra de acerto (0–100%) — nunca fora da faixa. */
export const accuracyWidth = (pct: number) => `${Math.min(100, Math.max(0, pct))}%`;

/** Teto espelhado do DTO do backend (`MAX_PRIZES` / `MAX_PRIZE_USD`). */
export const MAX_PRIZES = 100;
export const MAX_PRIZE_USD = 1_000_000;

/**
 * Prêmios digitados no admin ("10000, 5000, 2500" ou um por linha; "$" e
 * separador de milhar aceitos) → lista por posição. null = algo inválido.
 */
export function parsePrizes(raw: string): number[] | null {
  const parts = raw
    .split(/[\n;]+|,(?!\d{3}(?:\D|$))/)
    .map((p) => p.trim().replace(/[$\s]/g, "").replace(/,/g, ""))
    .filter(Boolean);
  if (parts.length > MAX_PRIZES) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n > MAX_PRIZE_USD) return null;
    out.push(n);
  }
  return out;
}

/** Lista de prêmios de volta ao texto do formulário. */
export const formatPrizes = (prizes: number[]) => prizes.join("\n");
