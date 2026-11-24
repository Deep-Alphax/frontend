"use client";

import { useQuery } from "@tanstack/react-query";

import type { MyAccess, UserRole } from "@/lib/api/access";
import { getMyAccount, PLAN_KEY, type MyAccount, type Plan } from "@/lib/api/billing";
import { useSession } from "@/lib/auth/useSession";

/** Intervalo e teto da espera pelo webhook depois do Checkout (~60s no total). */
const CHECKOUT_POLL_MS = 2_000;
const CHECKOUT_POLL_MAX = 30;

/** `true` quando a página acabou de voltar do Checkout com sucesso. */
function isCheckoutReturn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("checkout") === "success";
}

function asRole(role: string | undefined): UserRole {
  return role === "ADMIN" || role === "ELIXIR_ALPHA" ? role : "USER";
}

/**
 * Acesso efetivo a partir do que veio de `/billing/me`.
 *
 * Backend antigo (sem `access`): deriva com a MESMA regra do contrato
 * (`lib/api/access.ts`), usando o cargo da sessão. `restricted` fica `false`
 * nesse caso de propósito — um back que não conhece o cargo também não barra
 * nada, então esconder telas só criaria um beco sem saída.
 */
export function resolveAccess(account: MyAccount, sessionRole?: string): MyAccess {
  if (account.access) return account.access;
  const role = asRole(sessionRole);
  return {
    role,
    restricted: false,
    mentorship: account.plan === "PRO" || role === "ADMIN" || role === "ELIXIR_ALPHA",
  };
}

export interface PlanState {
  plan: Plan;
  isPro: boolean;
  isLoading: boolean;
  /** A leitura de `/billing/me` falhou (rede/5xx). */
  isError: boolean;
  /** `undefined` enquanto carrega, deslogado ou com erro. */
  access: MyAccess | undefined;
  /** Elixir Alpha no FREE: só Mentoria, Planos, Afiliados e KOLs (leitura). */
  isRestricted: boolean;
}

/**
 * Plano efetivo (+ acesso) do usuário logado — fonte ÚNICA para a UI (header,
 * /plans, gates de página e qualquer recurso que mude de cara entre FREE e PRO).
 *
 * Estado padrão (carregando ou deslogado) = FREE sem restrição: no máximo mostra
 * a oferta a mais, nunca libera nada. Quem barra recurso é o backend.
 *
 * Volta do Checkout: o Stripe redireciona ANTES de o webhook gravar a
 * assinatura (são eventos independentes), então a primeira leitura ainda diz
 * FREE. Com `?checkout=success` na URL o hook reconsulta a cada 2s até ver PRO,
 * com teto — se o webhook falhar, o polling para sozinho em vez de martelar a API.
 */
export function usePlan(): PlanState {
  const { isAuthenticated, profile } = useSession();
  const awaitingCheckout = isCheckoutReturn();

  const query = useQuery({
    queryKey: PLAN_KEY,
    queryFn: getMyAccount,
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: (q) =>
      awaitingCheckout &&
      q.state.data?.plan !== "PRO" &&
      q.state.dataUpdateCount < CHECKOUT_POLL_MAX
        ? CHECKOUT_POLL_MS
        : false,
  });

  // Só com sessão: o cache pode guardar o dado de antes do logout, e antes da
  // hidratação a sessão é "deslogado" (`useSession`) — ler o cache aqui faria
  // o cliente desenhar diferente do HTML do servidor.
  const data = isAuthenticated ? query.data : undefined;
  const plan: Plan = data?.plan ?? "FREE";
  const access = data ? resolveAccess(data, profile?.role) : undefined;
  return {
    plan,
    isPro: plan === "PRO",
    isLoading: query.isLoading,
    isError: query.isError,
    access,
    isRestricted: access?.restricted ?? false,
  };
}
