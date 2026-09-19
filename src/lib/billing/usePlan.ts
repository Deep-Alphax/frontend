"use client";

import { useQuery } from "@tanstack/react-query";

import { getMyPlan, PLAN_KEY, type Plan } from "@/lib/api/billing";
import { useSession } from "@/lib/auth/useSession";

/** Intervalo e teto da espera pelo webhook depois do Checkout (~60s no total). */
const CHECKOUT_POLL_MS = 2_000;
const CHECKOUT_POLL_MAX = 30;

/** `true` quando a página acabou de voltar do Checkout com sucesso. */
function isCheckoutReturn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("checkout") === "success";
}

/**
 * Plano efetivo do usuário logado — fonte ÚNICA para a UI (header, /plans e
 * qualquer recurso que mude de cara entre FREE e PRO).
 *
 * Estado padrão (carregando ou deslogado) = FREE: no máximo mostra a oferta a
 * mais, nunca libera nada. Quem barra recurso pago é o backend.
 *
 * Volta do Checkout: o Stripe redireciona ANTES de o webhook gravar a
 * assinatura (são eventos independentes), então a primeira leitura ainda diz
 * FREE. Com `?checkout=success` na URL o hook reconsulta a cada 2s até ver PRO,
 * com teto — se o webhook falhar, o polling para sozinho em vez de martelar a API.
 */
export function usePlan() {
  const { isAuthenticated } = useSession();
  const awaitingCheckout = isCheckoutReturn();

  const query = useQuery({
    queryKey: PLAN_KEY,
    queryFn: getMyPlan,
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: (q) =>
      awaitingCheckout &&
      q.state.data !== "PRO" &&
      q.state.dataUpdateCount < CHECKOUT_POLL_MAX
        ? CHECKOUT_POLL_MS
        : false,
  });

  const plan: Plan = query.data ?? "FREE";
  return {
    plan,
    isPro: plan === "PRO",
    isLoading: query.isLoading,
  };
}
