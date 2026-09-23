import { api } from "@/lib/api/client";

/** Meio de pagamento — espelha o `BillingProvider` do backend. */
export type PaymentProvider = "STRIPE" | "CRYPTO";

export type PaymentStatus = "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export const PAYMENT_PROVIDERS: PaymentProvider[] = ["STRIPE", "CRYPTO"];
export const PAYMENT_STATUSES: PaymentStatus[] = [
  "PAID",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

export interface PaymentItem {
  id: string;
  /** ISO — quando pagou (ou falhou). */
  paidAt: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  /** Valor cobrado, em centavos da `currency`. */
  amountCents: number;
  /** Quanto já foi reembolsado, em centavos da `currency`. */
  refundedCents: number;
  /** "usd" hoje; o Stripe pode trazer "brl" quando houver preço em reais. */
  currency: string;
  user: { id: string | null; email: string | null };
  /** Cripto: rede do pagamento ("SOLANA", "BASE"…). */
  chain: string | null;
  /** Cripto: transação on-chain. */
  txHash: string | null;
  /** Cripto: carteira que pagou. */
  payer: string | null;
  /** Stripe: id da fatura (in_…); cripto: "<CHAIN>:<txHash>". */
  providerRef: string;
  /** Fatura hospedada do Stripe ou transação no explorer da rede. */
  receiptUrl: string | null;
}

/** Totais sobre os MESMOS filtros da lista (ignora cursor/limit). Centavos de USD. */
export interface PaymentsSummary {
  receivedCents: number;
  refundedCents: number;
  paidCount: number;
  failedCount: number;
  currency: "usd";
}

export interface PaymentsPage {
  items: PaymentItem[];
  nextCursor: string | null;
  summary: PaymentsSummary;
}

export interface PaymentFilters {
  provider?: PaymentProvider;
  status?: PaymentStatus;
  /** Id exato ou parte do e-mail. */
  user?: string;
  /** ISO. */
  from?: string;
  /** ISO. */
  to?: string;
}

export interface PaymentsSyncResult {
  stripe: { imported: number };
  crypto: { imported: number };
  errors: string[];
}

export const PAYMENTS_KEY = ["admin-payments"] as const;

/** Tira do filtro os campos vazios — só vai para a URL o que foi preenchido. */
function cleanFilters(filters: PaymentFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return out;
}

/** GET /api/v1/admin/payments — mais recentes primeiro, paginado por cursor. */
export async function getPayments(
  filters: PaymentFilters,
  cursor?: string | null,
  limit = 50,
): Promise<PaymentsPage> {
  const params: Record<string, string | number> = {
    ...cleanFilters(filters),
    limit,
  };
  if (cursor) params.cursor = cursor;
  const { data } = await api.get<PaymentsPage>("/api/v1/admin/payments", { params });
  return data;
}

/**
 * POST /api/v1/admin/payments/sync — importa o histórico do Stripe e da rede
 * (idempotente: rodar de novo não duplica). Pode levar alguns segundos.
 */
export async function syncPayments(): Promise<PaymentsSyncResult> {
  const { data } = await api.post<PaymentsSyncResult>(
    "/api/v1/admin/payments/sync",
    undefined,
    { timeout: 120_000 },
  );
  return data;
}
