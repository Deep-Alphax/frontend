import { api } from "@/lib/api/client";
import type { BackendChain } from "@/lib/api/wallets";

/*
 * Depósito via Pix (decisão 2026-10-22): o usuário paga em reais e recebe a
 * cripto que escolheu NA CARTEIRA DELE, em qualquer rede suportada. Por trás:
 * Pix → USDT na Solana (Vai de Cripto) → Jupiter (destino Solana) ou deBridge
 * (destino EVM) → endereço do usuário. Espelha `backend/src/app/onramp/`.
 */

/** Uma moeda que dá para receber ("SOL na Solana", "BNB na BNB Chain"…). */
export interface DepositAsset {
  chain: BackendChain;
  /** "SOL", "BNB", "ETH", "POL", "USDC", "USDT". */
  symbol: string;
  name: string;
  /** Moeda nativa da rede (paga taxa de gás). */
  native: boolean;
}

export interface DepositOptions {
  /** false = depósito indisponível agora (sem credencial/tesouraria). */
  enabled: boolean;
  assets: DepositAsset[];
  /** Mínimo do provedor (US$ 100) em reais, na cotação atual; null = sem cotação agora. */
  minBrlCents: number | null;
  maxBrlCents: number;
  /** Quanto ainda cabe hoje no limite diário do usuário. */
  dailyLeftBrlCents: number;
  /** Taxa de serviço da plataforma (bps sobre o USDT). */
  feeBps: number;
  /** Reais por USDT (com o spread do provedor); null = sem cotação agora. */
  brlPerUsdt: number | null;
}

export interface DepositQuote {
  amountBrlCents: number;
  /** USDT comprado (decimal string, 6 casas). */
  usdt: string;
  /** Quanto o usuário deve receber (estimativa, decimal string na moeda escolhida); null = sem estimativa. */
  estimatedOut: string | null;
  symbol: string;
  /** Tempo estimado até cair na carteira, depois do Pix (segundos). */
  etaSeconds: number;
}

export type DepositStatus =
  /** Esperando o Pix. */
  | "PENDING"
  /** Pix recebido; envio na fila. */
  | "PAID"
  /** Enviando (swap/transferência ou ordem cross-chain sendo criada). */
  | "SENDING"
  /** Ordem cross-chain criada; esperando a entrega na rede de destino. */
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  /** QR venceu sem pagamento. */
  | "EXPIRED";

export interface DepositView {
  id: string;
  status: DepositStatus;
  chain: BackendChain;
  symbol: string;
  toAddress: string;
  amountBrlCents: number;
  usdt: string;
  brlPerUsdt: string;
  /** Só enquanto PENDING e já gerado. */
  qrCopyPaste: string | null;
  /** data:image/svg+xml;base64 — só enquanto PENDING e já gerado. */
  qrImage: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  /** Quanto chegou (decimal string); null até entregar. */
  deliveredAmount: string | null;
  deliveredAt: string | null;
  /** Explorer da NOSSA transação na Solana (swap/envio ou criação da ordem). */
  txUrl: string | null;
  /** Acompanhamento da ordem cross-chain (deBridge); null em destino Solana. */
  orderUrl: string | null;
  /** Mensagem para o usuário quando FAILED. */
  error: string | null;
  createdAt: string;
}

export const DEPOSITS_KEY = ["deposits"] as const;
const BASE = "/api/v1/deposits";

export const getDepositOptions = async () => (await api.get<DepositOptions>(`${BASE}/options`)).data;
export const getDepositQuote = async (p: { chain: BackendChain; symbol: string; amountBrlCents: number }) =>
  (await api.get<DepositQuote>(`${BASE}/quote`, { params: p })).data;
export const createDeposit = async (body: {
  chain: BackendChain;
  symbol: string;
  toAddress: string;
  amountBrlCents: number;
}) => (await api.post<DepositView>(BASE, body)).data;
export const getDeposit = async (id: string) => (await api.get<DepositView>(`${BASE}/${encodeURIComponent(id)}`)).data;
export const listDeposits = async () => (await api.get<{ items: DepositView[] }>(BASE)).data.items;
