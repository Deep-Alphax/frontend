import { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import { AuthCallback } from "@/components/auth/AuthCallback";

export const metadata: Metadata = {
  title: "Concluindo login — Deep Alpha",
  robots: { index: false, follow: false },
};

/** Fallback do Suspense enquanto o componente client (useSearchParams) hidrata. */
function CallbackFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center gap-3 bg-gray-1 text-gray-11">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span className="text-base">Concluindo login…</span>
    </main>
  );
}

/**
 * Callback do OAuth Google. O backend media o consent e redireciona para cá com
 * `?code=…&redirect_to=…`; o `AuthCallback` troca o code por sessão. Rota pública
 * (liberada no middleware) e não indexável.
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <AuthCallback />
    </Suspense>
  );
}
