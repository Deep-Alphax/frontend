import type { NextConfig } from "next";

/*
 * Security headers (incl. CSP) vivem no middleware `src/proxy.ts` — fonte única.
 * Aqui ficam só build/runtime tuning.
 */
const nextConfig: NextConfig = {
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
