import { api } from "@/lib/api/client";

/** Uma linha da tabela "History": UM indicado, com os totais dele. */
export interface AffiliateHistoryRow {
  id: string;
  /** Primeiro nome do indicado, ou o e-mail mascarado quando não há nome. */
  referredName: string;
  /** Tudo que este indicado já pagou. */
  spentCents: number;
  /** Tudo que ele já rendeu ao afiliado. */
  commissionCents: number;
  currency: string;
  /** ISO — quando a conta entrou pelo link. */
  startDate: string;
  /** ISO da última fatura paga; null quando nunca pagou. */
  lastSeenAt: string | null;
}

export interface AffiliateOverview {
  code: string;
  link: string;
  /** Percentuais EFETIVOS deste afiliado, em basis points (2000 = 20%). */
  level1Bps: number;
  level2Bps: number;
  currency: string;
  availableCents: number;
  totalCents: number;
  /** Receita bruta trazida pelos indicados — chip "Deposit". */
  depositCents: number;
  /** Comissão já repassada — chip "Spent". */
  paidOutCents: number;
  referralCount: number;
  convertedCount: number;
  history: AffiliateHistoryRow[];
}

/** Chave do painel de afiliados — invalide depois de trocar o código. */
export const AFFILIATES_KEY = ["affiliates-me"] as const;

/**
 * GET /api/v1/affiliates/me — código, link, ganhos e extrato do usuário logado.
 * O código nasce na primeira chamada (o backend gera e guarda).
 */
export async function getAffiliateOverview(): Promise<AffiliateOverview> {
  const { data } = await api.get<AffiliateOverview>("/api/v1/affiliates/me");
  return data;
}

/**
 * PATCH /api/v1/affiliates/code — troca o código e devolve o painel atualizado.
 * 400 = formato inválido · 409 = código já em uso.
 */
export async function updateReferralCode(
  code: string,
): Promise<AffiliateOverview> {
  const { data } = await api.patch<AffiliateOverview>(
    "/api/v1/affiliates/code",
    { code },
  );
  return data;
}

/** Centavos → "$10.00". O backend manda inteiro justamente para não arredondar. */
export function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * "5m ago" da coluna Last Seen. Relativo porque é o que o design mostra — a
 * pergunta ali é "faz quanto tempo", não "que dia".
 */
export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [60, "m"],
    [3600, "h"],
    [86400, "d"],
    [2592000, "mo"],
    [31536000, "y"],
  ];
  let label = "y";
  let divisor = 31536000;
  for (let i = units.length - 1; i >= 0; i -= 1) {
    if (seconds >= units[i][0]) {
      divisor = units[i][0];
      label = units[i][1];
      break;
    }
  }
  return `${Math.floor(seconds / divisor)}${label} ago`;
}

/** Basis points → "20%". */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

// ─────────────────────────── administração ───────────────────────────

export interface AffiliateSettings {
  level1Bps: number;
  level2Bps: number;
}

export interface AdminAffiliateRow {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  /** Exceção negociada; null = segue o padrão global. */
  level1Bps: number | null;
  level2Bps: number | null;
  referralCount: number;
  totalEarnedCents: number;
}

export const AFFILIATE_SETTINGS_KEY = ["affiliate-settings"] as const;
export const AFFILIATE_ADMIN_KEY = ["affiliate-admin"] as const;

/** GET /api/v1/affiliates/admin/settings — percentuais padrão. */
export async function getAffiliateSettings(): Promise<AffiliateSettings> {
  const { data } = await api.get<AffiliateSettings>(
    "/api/v1/affiliates/admin/settings",
  );
  return data;
}

/** PATCH /api/v1/affiliates/admin/settings — só afeta comissões futuras. */
export async function updateAffiliateSettings(
  input: AffiliateSettings,
): Promise<AffiliateSettings> {
  const { data } = await api.patch<AffiliateSettings>(
    "/api/v1/affiliates/admin/settings",
    input,
  );
  return data;
}

/** GET /api/v1/affiliates/admin — afiliados com condição e total rendido. */
export async function listAffiliates(): Promise<AdminAffiliateRow[]> {
  const { data } = await api.get<AdminAffiliateRow[]>("/api/v1/affiliates/admin");
  return data;
}

/**
 * PATCH /api/v1/affiliates/admin/:id/rates — condição negociada.
 * `null` num campo devolve o afiliado ao padrão global; 0 zera aquele nível.
 */
export async function setAffiliateRates(
  userId: string,
  input: { level1Bps?: number | null; level2Bps?: number | null },
): Promise<{ level1Bps: number | null; level2Bps: number | null }> {
  const { data } = await api.patch<{
    level1Bps: number | null;
    level2Bps: number | null;
  }>(`/api/v1/affiliates/admin/${userId}/rates`, input);
  return data;
}
