import type { WalletRef } from "@/lib/walletReader/types";

/*
 * Rede da carteira de um KOL — espelho de `backend/src/app/wallet-reader/
 * wallet-chain.ts`. As do selo "badge - rede" do Figma (1371:32284). O Tracker
 * acompanha Solana/ETH/Base/BNB; Robinhood Chain (EVM) é só cadastro por ora.
 */
export const WALLET_CHAINS = ["SOLANA", "ETHEREUM", "BASE", "BSC", "ROBINHOOD"] as const;
export type WalletChain = (typeof WALLET_CHAINS)[number];

export const WALLET_CHAIN_LABEL: Record<WalletChain, string> = {
  SOLANA: "Solana",
  ETHEREUM: "Ethereum",
  BASE: "Base",
  BSC: "BNB Chain",
  ROBINHOOD: "Robinhood Chain",
};

/** Rótulo curto dos botões de filtro (Figma "Filtro de redes", 1488:47853). */
export const WALLET_CHAIN_SHORT: Record<WalletChain, string> = {
  SOLANA: "SOL",
  ETHEREUM: "ETH",
  BASE: "Base",
  BSC: "BNB",
  ROBINHOOD: "RH",
};

const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/;

/** Família pelo formato: base58 = Solana; 0x+40 hex = EVM (mesmo endereço em toda rede EVM). */
export function addressFamily(address: string): "solana" | "evm" | null {
  const a = address.trim();
  if (EVM_ADDR.test(a)) return "evm";
  if (SOLANA_ADDR.test(a)) return "solana";
  return null;
}

/** Redes possíveis para um endereço (vazio/ inválido = todas, para o seletor). */
export function chainsForAddress(address: string): WalletChain[] {
  const f = addressFamily(address);
  if (f === "solana") return ["SOLANA"];
  if (f === "evm") return ["ETHEREUM", "BASE", "BSC", "ROBINHOOD"];
  return [...WALLET_CHAINS];
}

/**
 * Rede efetiva de uma carteira. Carteira antiga sem `chain`: Solana é
 * inequívoca pelo formato; EVM fica `null` (não dá para saber qual rede).
 */
export function walletChainOf(w: Pick<WalletRef, "address" | "chain">): WalletChain | null {
  if (w.chain) return w.chain;
  return addressFamily(w.address) === "solana" ? "SOLANA" : null;
}

/**
 * Rede a pré-selecionar ao digitar o endereço: Solana é a única opção para
 * base58; para 0x mantém a escolha se ainda couber, senão obriga a escolher.
 */
export function autoChain(address: string, current: WalletChain | null): WalletChain | null {
  const allowed = chainsForAddress(address);
  if (allowed.length === 1) return allowed[0];
  return current && allowed.includes(current) ? current : null;
}

/** Erro do formulário de nova carteira (null = pode adicionar). */
export function walletFormError(address: string, chain: WalletChain | null): string | null {
  const a = address.trim();
  if (!a) return null;
  const f = addressFamily(a);
  if (!f) return "Not a valid Solana or EVM (0x) address.";
  if (!chain) return "Choose the network of this wallet.";
  if (!chainsForAddress(a).includes(chain)) {
    return f === "solana"
      ? "This is a Solana address."
      : "EVM address: choose Ethereum, Base, BNB Chain or Robinhood Chain.";
  }
  return null;
}

/** Filtro do modal: "all", uma rede, ou "unknown" (EVM antiga sem rede). */
export type WalletChainFilter = "all" | WalletChain | "unknown";

export function filterWallets<T extends Pick<WalletRef, "address" | "chain">>(
  wallets: T[],
  filter: WalletChainFilter,
): T[] {
  if (filter === "all") return wallets;
  return wallets.filter((w) => (walletChainOf(w) ?? "unknown") === filter);
}

/** Contagem por rede — só as que aparecem (o filtro não mostra opção vazia). */
export function chainCounts(wallets: Pick<WalletRef, "address" | "chain">[]) {
  const counts = new Map<WalletChain | "unknown", number>();
  for (const w of wallets) {
    const k = walletChainOf(w) ?? "unknown";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const order: (WalletChain | "unknown")[] = [...WALLET_CHAINS, "unknown"];
  return order.filter((k) => counts.has(k)).map((k) => ({ id: k, count: counts.get(k)! }));
}
