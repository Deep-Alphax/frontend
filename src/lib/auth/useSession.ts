"use client";

import { useQuery } from "@tanstack/react-query";
import { getProfile, type AuthUser } from "@/lib/api/auth";
import { hasSessionHint } from "@/lib/auth/sessionHint";
import { useIsClient } from "@/lib/useIsClient";

export interface Session {
  profile: AuthUser | undefined;
  /** true quando GET /auth/profile respondeu com usuário (cookie httpOnly válido). */
  isAuthenticated: boolean;
  /** true enquanto a 1ª verificação de sessão está em andamento. */
  isLoading: boolean;
}

/**
 * Sessão do usuário no cliente, derivada de GET /api/v1/auth/profile.
 * - Deslogado (sem cookie-dica) → `enabled:false`: NENHUMA chamada à API.
 * - Logado → uma única consulta (`staleTime:Infinity` + `refetchOnMount:false`),
 *   imune a remount/re-render (não repete a chamada → sem rate-limit/429).
 * Compartilha o cache (queryKey "profile") entre Topbar/ProfileContent/etc.
 * NÃO é autorização (isso é do backend); só decide UI.
 */
export function useSession(): Session {
  // `enabled` só liga APÓS o mount: no servidor e no 1º render do cliente fica
  // desligado (isClient=false) → mesma saída nos dois (sem hydration mismatch);
  // só então lê o cookie-dica e, se logado, consulta o perfil.
  const isClient = useIsClient();
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: isClient && hasSessionHint(),
    retry: false,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    gcTime: 10 * 60_000,
  });

  return {
    profile: query.data,
    isAuthenticated: query.isSuccess && !!query.data,
    isLoading: query.isLoading,
  };
}
