import type { NextConfig } from "next";

/*
 * Security headers (incl. CSP) vivem no middleware `src/proxy.ts` — fonte única.
 * Aqui ficam só build/runtime tuning.
 */
const nextConfig: NextConfig = {
  // O conector "Base Account" (wagmi/AppKit) puxa @coinbase/cdp-sdk, que importa
  // (estática e dinamicamente) pacotes @x402/* (pagamento x402) NÃO instalados e
  // não usados aqui. Aponta todos esses specifiers para um stub vazio p/ o
  // Turbopack resolver o bundle — o código que os consome (signX402Payment)
  // nunca roda no fluxo de conexão de carteira.
  turbopack: {
    resolveAlias: {
      "@x402/core/client": "./src/lib/wallet/x402-stub.cjs",
      "@x402/core/server": "./src/lib/wallet/x402-stub.cjs",
      "@x402/evm": "./src/lib/wallet/x402-stub.cjs",
      "@x402/evm/batch-settlement/client": "./src/lib/wallet/x402-stub.cjs",
      "@x402/evm/exact/client": "./src/lib/wallet/x402-stub.cjs",
      "@x402/evm/exact/server": "./src/lib/wallet/x402-stub.cjs",
      "@x402/evm/exact/v1/client": "./src/lib/wallet/x402-stub.cjs",
      "@x402/evm/upto/client": "./src/lib/wallet/x402-stub.cjs",
      "@x402/evm/upto/server": "./src/lib/wallet/x402-stub.cjs",
      "@x402/express": "./src/lib/wallet/x402-stub.cjs",
      "@x402/extensions/bazaar": "./src/lib/wallet/x402-stub.cjs",
      "@x402/extensions/builder-code": "./src/lib/wallet/x402-stub.cjs",
      "@x402/fetch": "./src/lib/wallet/x402-stub.cjs",
      "@x402/svm/exact/client": "./src/lib/wallet/x402-stub.cjs",
      "@x402/svm/exact/server": "./src/lib/wallet/x402-stub.cjs",
      "@x402/svm/exact/v1/client": "./src/lib/wallet/x402-stub.cjs",
    },
  },

  // Remove console.* do bundle de produção (mantém error/warn p/ observabilidade).
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  images: {
    // Avatares do Google (login social).
    remotePatterns: [
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },

  compress: true,
  poweredByHeader: false,

  experimental: {
    // Tree-shaking mais agressivo para libs de UI usadas por barrel imports.
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-checkbox",
    ],
    webpackBuildWorker: true,
    parallelServerCompiles: true,
    parallelServerBuildTraces: true,
  },
};

export default nextConfig;
