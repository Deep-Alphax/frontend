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

/** Papel da carteira no catálogo do usuário. */
export type CatalogRole = "TRACKED" | "SOURCE";

export interface CatalogWalletInput {
  chain: BackendChain;
  address: string;
  role?: CatalogRole;
  label?: string;
}

export interface Wallet {
  id: string;
  chain: BackendChain;
  address: string;
  label: string | null;
  role: CatalogRole;
  syncStatus: "PENDING" | "SYNCING" | "SYNCED" | "ERROR";
}

/**
 * POST /api/v1/wallets — busca/cataloga um endereço público na conta (SEM assinatura).
 * Os dados on-chain são compartilhados (carteira canônica por chain+endereço); catalogar
 * é só um bookmark. Se a carteira for nova ou estiver desatualizada, dispara a ingestão.
 * 400 = endereço inválido ou limite atingido.
 */
export async function catalogWallet(input: CatalogWalletInput): Promise<Wallet> {
  const { data } = await api.post<Wallet>("/api/v1/wallets", input);
  return data;
}

/** GET /api/v1/wallets — carteiras catalogadas pelo usuário. */
export async function getWallets(): Promise<Wallet[]> {
  const { data } = await api.get<Wallet[]>("/api/v1/wallets");
  return data;
}

/** DELETE /api/v1/wallets/:id — remove a carteira do catálogo (os dados compartilhados ficam). */
export async function deleteWallet(id: string): Promise<void> {
  await api.delete(`/api/v1/wallets/${id}`);
}
