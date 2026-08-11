"use client";

import { WagmiProvider } from "wagmi";
import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { useIsClient } from "@/lib/useIsClient";
import {
  wagmiAdapter,
  networks,
  projectId,
  walletEnabled,
  appKitMetadata,
} from "./config";
import { WalletVerifier } from "./WalletVerifier";

/**
 * Inicializa o AppKit no CLIENTE (createAppKit e o SolanaAdapter tocam
 * DOM/`window`/wallet-standard). Escopo de módulo `appKitStarted` garante uma
 * única execução. `features`: só carteiras (sem email/socials/onramp/swaps) —
 * modal enxuto e menos chamadas externas (menor superfície de CSP/rede).
 */
let appKitStarted = false;
function ensureAppKit(): void {
  if (appKitStarted || !walletEnabled || !wagmiAdapter) return;
  appKitStarted = true;
  createAppKit({
    adapters: [wagmiAdapter, new SolanaAdapter()],
    networks,
    projectId,
    metadata: appKitMetadata,
    themeMode: "dark",
    features: {
      analytics: false,
      email: false,
      socials: false,
      onramp: false,
      swaps: false,
    },
  });
}

// Roda uma vez, só no cliente (import-time do bundle), ANTES de qualquer render
// que precise do modal. No servidor `window` é undefined → nunca roda no SSR.
if (typeof window !== "undefined") {
  ensureAppKit();
}

/**
 * Provider de carteira. O `WagmiProvider` (SSR-safe via ssr:true) envolve os
 * filhos normalmente — o SSR deles é preservado, sem remontar. Só o registro
 * pós-conexão (que usa hooks do AppKit) é montado apenas no cliente. Sem
 * projectId, é um passthrough puro (nenhum provider adicionado).
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();

  if (!walletEnabled || !wagmiAdapter) return <>{children}</>;

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      {isClient ? <WalletVerifier /> : null}
      {children}
    </WagmiProvider>
  );
}
