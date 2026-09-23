"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { PageViewTracker } from "@/components/audit/PageViewTracker";
import { captureReferralFromUrl } from "@/lib/referral";

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

  // Captura o `?ref=` do link de afiliado em QUALQUER rota, não só no cadastro:
  // o link circula apontando para a home e para /plans, e quem cai ali e se
  // cadastra depois tem que continuar atribuído.
  useEffect(() => {
    captureReferralFromUrl(window.location.search);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Dentro do provider: o rastreador usa `useSession` (React Query). */}
      <PageViewTracker />
      {children}
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
