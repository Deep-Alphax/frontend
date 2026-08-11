import { api } from "@/lib/api/client";

/** Chains suportadas pelo backend (enum Prisma `Chain`). */
export type BackendChain =
  | "SOLANA"
  | "ETHEREUM"
  | "BASE"
  | "ARBITRUM"
  | "BSC"
  | "POLYGON"
  | "OPTIMISM";

export interface CreateWalletInput {
  chain: BackendChain;
  address: string;
  /** Assinatura da mensagem de verificação (prova de posse). Hex no EVM; base64 no Solana. */
  signature: string;
  label?: string;
}

export interface Wallet {
  id: string;
  chain: BackendChain;
  address: string;
  label: string | null;
  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "ERROR";
}

/**
 * POST /api/v1/wallets/verify/nonce — passo 1: pede a mensagem a assinar para
 * provar posse do endereço (o backend controla a mensagem, anti-tamper).
 */
export async function requestWalletNonce(input: {
  chain: BackendChain;
  address: string;
}): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>("/api/v1/wallets/verify/nonce", input);
  return data;
}

/**
 * POST /api/v1/wallets — passo 2: cadastra a carteira validando a assinatura
 * (prova de posse) e dispara a ingestão. 401 = assinatura inválida; 400 =
 * verificação expirada; 409 = endereço já cadastrado como fonte.
 */
export async function createWallet(input: CreateWalletInput): Promise<Wallet> {
  const { data } = await api.post<Wallet>("/api/v1/wallets", input);
  return data;
}

/** GET /api/v1/wallets — carteiras OWN do usuário (para saber se há carteira conectada). */
export async function getWallets(): Promise<Wallet[]> {
  const { data } = await api.get<Wallet[]>("/api/v1/wallets");
  return data;
}

/** DELETE /api/v1/wallets/:id — remove a carteira (e seus trades/métricas, via cascade). */
export async function deleteWallet(id: string): Promise<void> {
  await api.delete(`/api/v1/wallets/${id}`);
}
