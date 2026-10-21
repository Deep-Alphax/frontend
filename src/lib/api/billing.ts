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

/** Como o PRO vigente foi pago. `CRYPTO` e `PIX` são pré-pagos e não renovam. */
export type BillingProvider = "STRIPE" | "CRYPTO" | "PIX";

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
  /** Contrato do USDC (EVM) ou mint (Solana) na rede da cobrança. */
  tokenAddress: string;
  /** Casas do token NA REDE: 6, exceto BSC (Binance-Peg, 18). */
  tokenDecimals: number;
  /** Chain id EVM; `null` na Solana. */
  chainId: number | null;
  /** Valor a enviar, em decimal ("50"). A carteira envia exatamente isto. */
  amount: string;
  receiver: string;
  /** Solana Pay: chave que vai na transferência (conta só-leitura). */
  reference: string | null;
  periodDays: number;
  expiresAt: string;
  confirmedAt: string | null;
  txHash: string | null;
  /** Transação já enviada e em confirmação — não oferecer pagar de novo. */
  submittedTxHash: string | null;
  /** Carteira que enviou (a conectada no momento do envio). */
  declaredPayer: string | null;
  /**
   * EVM: mensagem que a carteira assina ANTES de pagar. Prova ao servidor que
   * quem registra o hash é o dono da carteira de origem — sem isso, qualquer um
   * que visse a transferência pública poderia reivindicá-la. `null` na Solana
   * (lá a `reference` na própria transação faz esse papel).
   */
  ownershipMessage: string | null;
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

export interface SentCryptoTx {
  /** Hash (EVM) ou assinatura base58 (Solana) devolvida pela carteira. */
  txHash: string;
  /** Carteira conectada que assinou. */
  payer: string;
  /** EVM: assinatura de `ownershipMessage` pela `payer`. */
  signature?: string;
}

/**
 * Informa a transação que a carteira acabou de enviar. O servidor confere na
 * própria rede (o front não é autoridade): volta CONFIRMED, PENDING enquanto
 * confirma, ou 400 se a transação não paga esta cobrança.
 */
export async function submitCryptoPayment(
  id: string,
  sent: SentCryptoTx,
): Promise<CryptoPayment> {
  const { data } = await api.post<CryptoPayment>(
    `/api/v1/billing/crypto/payments/${encodeURIComponent(id)}/submit`,
    {
      txHash: sent.txHash,
      payer: sent.payer,
      ...(sent.signature ? { signature: sent.signature } : {}),
    },
  );
  return data;
}

export async function getCryptoPayment(id: string): Promise<CryptoPayment> {
  const { data } = await api.get<CryptoPayment>(
    `/api/v1/billing/crypto/payments/${encodeURIComponent(id)}`,
  );
  return data;
}

// ─── Pré-pago em Pix (Vai de Cripto) ────────────────────────────────────────

export interface PixOptions {
  /** Pix ligado no servidor (credenciais da Vai de Cripto configuradas). */
  enabled: boolean;
  periodDays: number;
  amountUsdCents?: number;
  /** Valor em reais de AGORA (só exibição — a cobrança trava o seu). */
  quoteBrlCents?: number | null;
}

export type PixPaymentStatus = "PENDING" | "CONFIRMED" | "EXPIRED" | "FAILED" | "REFUNDED";

export interface PixPayment {
  id: string;
  status: PixPaymentStatus;
  amountBrlCents: number;
  amountUsdCents: number;
  /** Reais por USDT da cotação travada na cobrança ("5.913600"). */
  fxRate: string;
  periodDays: number;
  /**
   * Pix copia e cola — só enquanto dá para pagar. O backend omite `null`;
   * ausente com status PENDING = o QR ainda está sendo gerado.
   */
  qrCopyPaste?: string | null;
  /** QR em data URL (SVG gerado no servidor). */
  qrImage?: string | null;
  expiresAt?: string | null;
  confirmedAt?: string | null;
}

export async function getPixOptions(): Promise<PixOptions> {
  const { data } = await api.get<PixOptions>("/api/v1/billing/pix/options");
  return data;
}

/** Abre a cobrança. Nenhum dado do pagador é pedido: qualquer conta pode pagar. */
export async function createPixPayment(): Promise<PixPayment> {
  const { data } = await api.post<PixPayment>("/api/v1/billing/pix/payments");
  return data;
}

export async function getPixPayment(id: string): Promise<PixPayment> {
  const { data } = await api.get<PixPayment>(
    `/api/v1/billing/pix/payments/${encodeURIComponent(id)}`,
  );
  return data;
}

export interface SolanaBlockhash {
  blockhash: string;
  lastValidBlockHeight: number;
}

/**
 * Blockhash recente para montar a transferência Solana. Vem do backend para o
 * navegador não falar com RPC nenhum (CSP só libera a API).
 */
export async function getSolanaBlockhash(): Promise<SolanaBlockhash> {
  const { data } = await api.get<SolanaBlockhash>(
    "/api/v1/billing/crypto/solana/blockhash",
  );
  return data;
}
