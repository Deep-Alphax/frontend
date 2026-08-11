"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "@/lib/wallet/WalletProvider";

/**
 * Providers globais do client (React Query + toasts).
 *
 * `useState` na criação do QueryClient garante UMA instância por árvore de
 * render no cliente — evita recriar o cache a cada re-render e evita vazar
 * estado entre requisições no SSR.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* WalletProvider precisa do QueryClient acima (wagmi usa React Query). */}
      <WalletProvider>{children}</WalletProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-gray-2)",
            color: "var(--color-gray-12)",
            border: "1px solid var(--color-gray-6)",
            fontFamily: "var(--font-body), sans-serif",
            fontSize: "14px",
          },
        }}
      />
    </QueryClientProvider>
  );
}
