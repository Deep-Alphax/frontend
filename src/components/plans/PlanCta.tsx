"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { createCheckout, getMyPlan, PLAN_KEY, type Plan } from "@/lib/api/billing";
import { getApiErrorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";

interface PlanCtaProps {
  tone: "free" | "pro";
}

/**
 * CTA do card de plano. Precisa ser client porque decide o rótulo a partir do
 * plano do usuário e dispara o checkout.
 *
 * Estado padrão (carregando ou deslogado) = FREE. É o piso seguro: no máximo
 * oferece assinar para quem já assina, nunca esconde a oferta de quem não tem.
 * Quem barra recurso pago é o `PlanGuard` no backend, não este componente.
 */
export function PlanCta({ tone }: PlanCtaProps) {
  const { isAuthenticated } = useSession();

  const { data: plan, isLoading } = useQuery({
    queryKey: PLAN_KEY,
    queryFn: getMyPlan,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const current: Plan = plan ?? "FREE";

  const checkout = useMutation({
    mutationFn: createCheckout,
    onSuccess: (url) => {
      // Sai da SPA de propósito: o Checkout é hospedado pelo Stripe.
      window.location.href = url;
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (tone === "free") {
    // O Free nunca é comprável — o botão só informa em qual plano você está.
    return (
      <Button
        variant="secondary"
        disabled
        className="h-11 bg-gray-3 p-0 disabled:cursor-default disabled:opacity-100"
      >
        {current === "FREE" ? "Current plan" : "Free plan"}
      </Button>
    );
  }

  if (current === "PRO") {
    return (
      <Button
        variant="primary"
        disabled
        className="disabled:cursor-default disabled:opacity-100"
      >
        Current plan
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      disabled={isLoading || checkout.isPending}
      onClick={() => {
        if (!isAuthenticated) {
          // Sem sessão o backend recusaria com 401 — mandar para o login com
          // retorno é mais útil que mostrar um erro.
          window.location.href = "/login?next=/plans";
          return;
        }
        checkout.mutate();
      }}
    >
      {checkout.isPending ? "Opening checkout…" : "Choose this plan"}
    </Button>
  );
}
