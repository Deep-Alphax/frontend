"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { sendPageView } from "@/lib/api/audit";
import { useSession } from "@/lib/auth/useSession";

/**
 * Registra no log de auditoria cada página aberta por um usuário LOGADO.
 *
 * - Só o `pathname` (de `usePathname`): a query string pode carregar tokens.
 * - Mesmo path seguido não repete (re-render, refetch de sessão, Strict Mode).
 * - Falha é engolida: auditoria nunca pode quebrar nem travar a navegação.
 * - Não renderiza nada; o envio acontece depois do paint (effect).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const { isAuthenticated } = useSession();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !pathname) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    sendPageView(pathname).catch(() => {
      // Auditoria é acessória: sem log, a página segue funcionando.
    });
  }, [pathname, isAuthenticated]);

  return null;
}
