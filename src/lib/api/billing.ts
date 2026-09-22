import { api } from "@/lib/api/client";

/** Planos do produto — espelha o enum `Plan` do backend. */
export type Plan = "FREE" | "PRO";

/**
 * Plano EFETIVO do usuário logado, decidido no servidor.
 *
 * Isto é só para a UI (marcar o card certo, abrir upsell). O que barra recurso
 * pago é o `PlanGuard` no backend — o front nunca é a autoridade sobre acesso.
 */
export async function getMyPlan(): Promise<Plan> {
  const { data } = await api.get<{ plan: Plan }>("/api/v1/billing/me");
  return data.plan;
}

/** Abre o Checkout de assinatura e devolve a URL para redirecionar. */
export async function createCheckout(): Promise<string> {
  const { data } = await api.post<{ url: string }>("/api/v1/billing/checkout");
  return data.url;
}

/**
 * Chave do plano efetivo no React Query — invalide após voltar do checkout.
 *
 * Vive aqui (e não no componente) porque o header e a tela de planos consultam o
 * mesmo dado: chaves separadas dariam duas requisições e dois estados divergentes.
 */
export const PLAN_KEY = ["billing-plan"] as const;

/** Como o PRO vigente foi pago. `CRYPTO` é pré-pago e não renova sozinho. */
export type BillingProvider = "STRIPE" | "CRYPTO";

export interface BillingDetails {
  provider: BillingProvider;
  /** ISO. Até quando o acesso pago vale. */
  currentPeriodEnd: string | null;
  /** `true` = não renova (cartão cancelado ou pré-pago). */
  cancelAtPeriodEnd: boolean;
}

/**
 * Detalhe da cobrança vigente (null sem assinatura viva). Só a tela de planos
 * precisa disto, então vive numa chave própria — o `PLAN_KEY` continua sendo só
 * o plano, que é o que o header e o socket (`useAccountEvents`) gravam.
 */
export async function getBillingDetails(): Promise<BillingDetails | null> {
  const { data } = await api.get<{ plan: Plan; billing: BillingDetails | null }>(
    "/api/v1/billing/me",
  );
  return data.billing ?? null;
}

export const BILLING_DETAILS_KEY = ["billing-details"] as const;

// ─── Pré-pago em cripto (USDC) ──────────────────────────────────────────────

export type EvmChain =
  | "ETHEREUM"
  | "BASE"
  | "ARBITRUM"
  | "OPTIMISM"
  | "POLYGON"
  | "BSC";
export type CryptoChain = "SOLANA" | EvmChain;

export function isEvmChain(chain: CryptoChain): chain is EvmChain {
  return chain !== "SOLANA";
}

export interface CryptoOptions {
  token: "USDC";
  amount: string;
  periodDays: number;
  /** Redes ligadas no servidor. Vazio = cripto indisponível. */
  chains: CryptoChain[];
}

export interface CryptoPayment {
  id: string;
  chain: CryptoChain;
  status: "PENDING" | "CONFIRMED" | "EXPIRED";
  token: "USDC";
  tokenAddress: string;
  /** Valor EXATO a enviar ("50.012345" na Base). */
  amount: string;
  receiver: string;
  reference: string | null;
  paymentUri: string;
  /** QR gerado no servidor (data URL de PNG). */
  qrDataUrl: string;
  periodDays: number;
  expiresAt: string;
  confirmedAt: string | null;
  txHash: string | null;
  /** Carteira que o usuário informou ter usado (null até clicar "enviei"). */
  declaredPayer: string | null;
}

export async function getCryptoOptions(): Promise<CryptoOptions> {
  const { data } = await api.get<CryptoOptions>("/api/v1/billing/crypto/options");
  return data;
}

/** Abre (ou reaproveita, se já houver uma aberta) a cobrança na rede escolhida. */
export async function createCryptoPayment(chain: CryptoChain): Promise<CryptoPayment> {
  const { data } = await api.post<CryptoPayment>("/api/v1/billing/crypto/payments", {
    chain,
  });
  return data;
}

/**
 * "Enviei": informa de qual carteira o usuário pagou e pede ao servidor para
 * procurar o pagamento na hora. Volta CONFIRMED se achou; PENDING se ainda não.
 */
export async function submitCryptoPayment(
  id: string,
  payer: string,
): Promise<CryptoPayment> {
  const { data } = await api.post<CryptoPayment>(
    `/api/v1/billing/crypto/payments/${encodeURIComponent(id)}/submit`,
    { payer },
  );
  return data;
}

export async function getCryptoPayment(id: string): Promise<CryptoPayment> {
  const { data } = await api.get<CryptoPayment>(
    `/api/v1/billing/crypto/payments/${encodeURIComponent(id)}`,
  );
  return data;
}
