import { api } from "@/lib/api/client";

/*
 * Cupons de PRO grátis (decisão 2026-11-09).
 *
 * O admin cria um código compartilhável (ex.: LAUNCH30) que dá N dias de PRO,
 * com teto de usos e validade opcional. Só quem NUNCA teve PRO resgata (nem
 * pago, nem cupom), e cada conta resgata UM cupom na vida. No fim dos dias a
 * conta volta ao FREE sozinha — não há cobrança nem renovação.
 *
 * Contrato escrito ANTES do back e do front: os dois lados seguem estes tipos.
 * Todas as rotas respondem com o corpo INTACTO (`@RawResponse`), então `null`
 * chega como `null`.
 */

// ─── Usuário ────────────────────────────────────────────────────────────────

export interface CouponRedemptionResult {
  plan: "PRO";
  /** Dias concedidos por este cupom. */
  days: number;
  /** ISO — quando o PRO grátis acaba. */
  currentPeriodEnd: string;
}

/**
 * POST /api/v1/billing/coupons/redeem — resgata o cupom para o usuário logado.
 *
 * O código é normalizado no servidor (trim + maiúsculas), então o front pode
 * mandar como o usuário digitou. Limite: 5 tentativas por minuto (429).
 *
 * Erros (a `message` já vem em inglês, pronta para a tela):
 *  - 404 código inexistente ou desativado ("Invalid coupon code.");
 *  - 410 cupom vencido ou esgotado;
 *  - 409 conta não elegível (já teve PRO, já usou um cupom, ou PRO ativo).
 */
export async function redeemCoupon(
  code: string,
): Promise<CouponRedemptionResult> {
  const { data } = await api.post<CouponRedemptionResult>(
    "/api/v1/billing/coupons/redeem",
    { code },
  );
  return data;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export interface AdminCoupon {
  id: string;
  /** Sempre em maiúsculas: A–Z, 0–9 e "-", de 3 a 32 caracteres. */
  code: string;
  /** Dias de PRO que cada resgate concede (1–365). Imutável depois de criado. */
  days: number;
  /** Teto de resgates (1–100000). */
  maxRedemptions: number;
  redeemedCount: number;
  /** ISO. Depois disso ninguém mais resgata. `null` = sem validade. */
  expiresAt: string | null;
  /** Desativado = ninguém mais resgata; quem já resgatou mantém os dias. */
  active: boolean;
  /** Anotação interna do admin (ex.: "campanha KOL X"). Nunca vai ao usuário. */
  note: string | null;
  createdAt: string;
}

export interface AdminCouponRedemption {
  id: string;
  /** null quando a conta foi excluída depois do resgate. */
  userId: string | null;
  userEmail: string;
  /** ISO. */
  redeemedAt: string;
  /** ISO — fim do PRO grátis concedido neste resgate. */
  periodEnd: string;
}

export interface CreateCouponInput {
  code: string;
  days: number;
  maxRedemptions: number;
  /** ISO; omitir ou null = sem validade. Precisa estar no futuro. */
  expiresAt?: string | null;
  /** Até 200 caracteres. */
  note?: string | null;
}

/** Só os campos enviados mudam. `maxRedemptions` não pode ficar abaixo de `redeemedCount`. */
export interface UpdateCouponInput {
  active?: boolean;
  maxRedemptions?: number;
  expiresAt?: string | null;
  note?: string | null;
}

export const ADMIN_COUPONS_KEY = ["admin-coupons"] as const;

/** GET /api/v1/billing/coupons/admin — todos os cupons, mais recentes primeiro (até 500). */
export async function listCoupons(): Promise<AdminCoupon[]> {
  const { data } = await api.get<AdminCoupon[]>("/api/v1/billing/coupons/admin");
  return data;
}

/**
 * POST /api/v1/billing/coupons/admin — cria um cupom.
 * 400 = campo inválido · 409 = código já existe.
 */
export async function createCoupon(input: CreateCouponInput): Promise<AdminCoupon> {
  const { data } = await api.post<AdminCoupon>(
    "/api/v1/billing/coupons/admin",
    input,
  );
  return data;
}

/** PATCH /api/v1/billing/coupons/admin/:id — 404 cupom inexistente · 400 campo inválido. */
export async function updateCoupon(
  id: string,
  input: UpdateCouponInput,
): Promise<AdminCoupon> {
  const { data } = await api.patch<AdminCoupon>(
    `/api/v1/billing/coupons/admin/${encodeURIComponent(id)}`,
    input,
  );
  return data;
}

/** GET /api/v1/billing/coupons/admin/:id/redemptions — quem resgatou, mais recentes primeiro (até 200). */
export async function listCouponRedemptions(
  id: string,
): Promise<AdminCouponRedemption[]> {
  const { data } = await api.get<AdminCouponRedemption[]>(
    `/api/v1/billing/coupons/admin/${encodeURIComponent(id)}/redemptions`,
  );
  return data;
}
