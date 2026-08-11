"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { validateGoogleCode } from "@/lib/api/auth";
import { getApiErrorMessage } from "@/lib/api/client";
import { safeRedirect } from "@/lib/auth/redirect";

/**
 * Finaliza o login com Google: lê `code`/`redirect_to` do callback (o backend já
 * mediou o consent) e troca o code por uma sessão. Sucesso → reload completo no
 * destino (garante estado de sessão limpo: cookies novos + cache zerado). Erro →
 * mensagem com volta ao login. Idempotente: o code só é trocado uma vez (o
 * Google invalida o code no 1º uso; um refresh não deve tentar de novo).
 */
export function AuthCallback() {
  const params = useSearchParams();
  const started = useRef(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);

  const code = params.get("code");
  const oauthError = params.get("error");
  const redirectTo = safeRedirect(params.get("redirect_to"));
  // Sem code (ou erro vindo do Google) já é inválido — derivado no render, não em effect.
  const invalid = Boolean(oauthError) || !code;

  useEffect(() => {
    if (invalid || started.current) return;
    started.current = true;

    validateGoogleCode(code as string)
      .then(() => {
        // Reload real (não router.replace): descarta o cache de sessão anterior e
        // faz a nova página ler o cookie-dica já presente.
        window.location.replace(redirectTo);
      })
      .catch((err: unknown) => {
        setAsyncError(getApiErrorMessage(err, "Não foi possível concluir o login com Google."));
      });
  }, [invalid, code, redirectTo]);

  const error = invalid ? "Login com Google cancelado ou inválido." : asyncError;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gray-1 px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/deep-alpha-logo.svg"
        alt="Deep Alpha"
        width={148}
        height={32}
        className="h-8 w-auto"
      />

      {error ? (
        <div className="flex max-w-sm flex-col items-center gap-4">
          <p className="text-base text-gray-11">{error}</p>
          <Link
            href="/login"
            className="rounded-lg bg-principal-9 px-5 py-2.5 text-sm font-medium text-gray-1 transition-colors hover:bg-principal-10"
          >
            Voltar ao login
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-gray-11">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-base">Concluindo login com Google…</span>
        </div>
      )}
    </main>
  );
}
