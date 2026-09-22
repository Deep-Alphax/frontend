"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { CryptoPayModal } from "@/components/plans/CryptoPayModal";
import { Button } from "@/components/ui/Button";
import {
  BILLING_DETAILS_KEY,
  createCheckout,
  getBillingDetails,
  getCryptoOptions,
} from "@/lib/api/billing";
import { getApiErrorMessage } from "@/lib/api/client";
import { useSession } from "@/lib/auth/useSession";
import { usePlan } from "@/lib/billing/usePlan";

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

  const { plan: current, isLoading } = usePlan();
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const closeCrypto = useCallback(() => setCryptoOpen(false), []);

  // Só o card PRO pergunta — o FREE não oferece nada para comprar.
  const cryptoOptions = useQuery({
    queryKey: ["crypto-options"],
    queryFn: getCryptoOptions,
    enabled: isAuthenticated && tone === "pro",
    staleTime: 5 * 60_000,
  });
  const billing = useQuery({
    queryKey: BILLING_DETAILS_KEY,
    queryFn: getBillingDetails,
    enabled: isAuthenticated && tone === "pro",
    staleTime: 60_000,
  });

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

  const cryptoChains = cryptoOptions.data?.chains ?? [];
  // Cripto só é oferecido quando: há rede ligada no servidor E o usuário não
  // tem cartão renovando (o servidor recusaria — ver `cryptoBlockReason`).
  const cardRenewing =
    billing.data?.provider === "STRIPE" && !billing.data.cancelAtPeriodEnd;
  const canPayCrypto = cryptoChains.length > 0 && !cardRenewing;

  const cryptoModal = cryptoOptions.data ? (
    <CryptoPayModal
      open={cryptoOpen}
      chains={cryptoChains}
      amount={cryptoOptions.data.amount}
      periodDays={cryptoOptions.data.periodDays}
      onClose={closeCrypto}
    />
  ) : null;

  if (current === "PRO") {
    const until = billing.data?.cancelAtPeriodEnd
      ? formatDate(billing.data.currentPeriodEnd)
      : null;
    return (
      <div className="flex w-full flex-col gap-2">
        {billing.data?.provider === "CRYPTO" && canPayCrypto ? (
          <Button variant="primary" onClick={() => setCryptoOpen(true)}>
            Renew with USDC
          </Button>
        ) : (
          <Button
            variant="primary"
            disabled
            className="disabled:cursor-default disabled:opacity-100"
          >
            Current plan
          </Button>
        )}
        {until && (
          <p className="text-center text-sm text-gray-11">
            Pro until {until}
            {billing.data?.provider === "STRIPE" && canPayCrypto && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setCryptoOpen(true)}
                  className="font-semibold text-principal-11 hover:underline"
                >
                  Extend with USDC
                </button>
              </>
            )}
          </p>
        )}
        {cryptoModal}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
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
      {canPayCrypto && (
        <Button
          variant="secondary"
          className="h-11 p-0"
          onClick={() => setCryptoOpen(true)}
        >
          Pay with USDC
        </Button>
      )}
      {cryptoModal}
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
