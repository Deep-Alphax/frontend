import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest + React Testing Library.
// - `resolve.tsconfigPaths` resolve o alias "@/..." nativamente a partir do tsconfig.
// - jsdom como ambiente padrão (testes de componente/RTL); testes de lógica
//   pura (lib/utils) rodam normalmente nele também.
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    // Thread única, sem paralelismo de arquivos: estável em ambientes lentos/
    // Windows (o pool de forks estava estourando timeout de worker). API v4:
    // pool-options viraram top-level.
    pool: "threads",
    maxWorkers: 1,
    fileParallelism: false,
  },
});
