import { api } from "@/lib/api/client";

/** Planos do produto — espelha o enum `Plan` do backend. */
export type Plan = "FREE" | "PRO";

/**
 * Plano EFETIVO do usuário logado, decidido no servidor.
 *
 * Isto é só para a UI (marcar o card certo, abrir upsell). O que barra recurso
 * pago é o `PlanGuard` no backend — o front nunca é a autoridade sobre acesso.
 */
export async function getMyPlan(): Promise<Plan> {
  const { data } = await api.get<{ plan: Plan }>("/api/v1/billing/me");
  return data.plan;
}

/** Abre o Checkout de assinatura e devolve a URL para redirecionar. */
export async function createCheckout(): Promise<string> {
  const { data } = await api.post<{ url: string }>("/api/v1/billing/checkout");
  return data.url;
}
