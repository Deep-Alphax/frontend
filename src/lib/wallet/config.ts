import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  mainnet,
  base,
  arbitrum,
  bsc,
  polygon,
  optimism,
  solana,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { REOWN_PROJECT_ID, APP_URL } from "@/lib/env";
import type { BackendChain } from "@/lib/api/wallets";

/**
 * Configuração do wallet connect (Reown AppKit) — EVM + Solana.
 * Sem `NEXT_PUBLIC_REOWN_PROJECT_ID`, `walletEnabled=false` e o modal fica
 * desligado (o botão avisa). Todas as redes EVM espelham o enum `Chain` do backend.
 */

export const projectId = REOWN_PROJECT_ID;
export const walletEnabled = projectId.length > 0;

/** Redes EVM suportadas (= enum Chain do backend). Solana entra à parte. */
const evmNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  base,
  arbitrum,
  bsc,
  polygon,
  optimism,
];

/** Todas as redes do modal (EVM + Solana). Tupla não-vazia exigida pelo AppKit. */
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  base,
  arbitrum,
  bsc,
  polygon,
  optimism,
  solana,
];

/**
 * Adapter EVM (wagmi). Construído em escopo de módulo porque o `WagmiProvider`
 * precisa do `wagmiConfig` já no render — `ssr: true` + cookieStorage tornam isso
 * seguro no SSR (é o caminho suportado pelo wagmi). O adapter Solana e o
 * `createAppKit` (que tocam DOM) ficam client-only no `WalletProvider`.
 */
export const wagmiAdapter = walletEnabled
  ? new WagmiAdapter({
      networks: evmNetworks,
      projectId,
      ssr: true,
      storage: createStorage({ storage: cookieStorage }),
    })
  : null;

/** Metadata exibida na carteira do usuário ao aprovar a conexão. */
export const appKitMetadata = {
  name: "Deep Alpha",
  description: "Analytics on-chain do seu trading.",
  url: APP_URL,
  icons: [`${APP_URL}/brand/deep-alpha-logomark.svg`],
};

/** chainId EVM (viem) → enum Chain do backend. */
const EVM_CHAIN_BY_ID: Record<number, BackendChain> = {
  1: "ETHEREUM",
  8453: "BASE",
  42161: "ARBITRUM",
  56: "BSC",
  137: "POLYGON",
  10: "OPTIMISM",
};

/**
 * Mapeia a rede ativa do AppKit (CAIP) para o enum Chain do backend.
 * Solana → SOLANA; EVM → pela chainId. Rede não suportada → null (não registra).
 */
export function chainFromCaipNetwork(net: {
  chainNamespace?: string;
  id?: string | number;
}): BackendChain | null {
  if (net.chainNamespace === "solana") return "SOLANA";
  if (net.chainNamespace === "eip155") {
    return EVM_CHAIN_BY_ID[Number(net.id)] ?? null;
  }
  return null;
}
