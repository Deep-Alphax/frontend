"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { CryptoPayModal } from "@/components/plans/CryptoPayModal";
import { PixPayModal } from "@/components/plans/PixPayModal";
import {
  type MethodState,
  PaymentMethodModal,
} from "@/components/plans/PaymentMethodModal";
import { Button } from "@/components/ui/Button";
import {
  BILLING_DETAILS_KEY,
  createCheckout,
  getBillingDetails,
  getCryptoOptions,
  getPixOptions,
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
  const [pixOpen, setPixOpen] = useState(false);
  const closePix = useCallback(() => setPixOpen(false), []);
  // "Choose this plan" abre a escolha do meio: cartão, USDC ou Pix.
  const [methodOpen, setMethodOpen] = useState(false);
  const closeMethod = useCallback(() => setMethodOpen(false), []);

  // Só o card PRO pergunta — o FREE não oferece nada para comprar.
  const cryptoOptions = useQuery({
    queryKey: ["crypto-options"],
    queryFn: getCryptoOptions,
    enabled: isAuthenticated && tone === "pro",
    staleTime: 5 * 60_000,
  });
  const pixOptions = useQuery({
    queryKey: ["pix-options"],
    queryFn: getPixOptions,
    enabled: isAuthenticated && tone === "pro",
    // O valor em reais segue a cotação; a cobrança trava o seu na criação.
    // Sem valor (a cotação demorou no servidor), a próxima visita pede de novo.
    staleTime: (q) => (q.state.data?.quoteBrlCents == null ? 0 : 5 * 60_000),
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
  // Mesma trava do cripto no servidor (`cryptoBlockReason`).
  const canPayPix = pixOptions.data?.enabled === true && !cardRenewing;

  const modals = (
    <>
      {cryptoOptions.data ? (
        <CryptoPayModal
          open={cryptoOpen}
          chains={cryptoChains}
          amount={cryptoOptions.data.amount}
          periodDays={cryptoOptions.data.periodDays}
          onClose={closeCrypto}
        />
      ) : null}
      {pixOptions.data?.enabled ? (
        <PixPayModal
          open={pixOpen}
          quoteBrlCents={pixOptions.data.quoteBrlCents ?? null}
          amountUsdCents={pixOptions.data.amountUsdCents ?? null}
          periodDays={pixOptions.data.periodDays}
          onClose={closePix}
        />
      ) : null}
    </>
  );

  // PRO grátis de cupom: é PRO, mas não foi pago — continua podendo pagar para
  // seguir no PRO depois. Cai no fluxo de compra, não no de "plano atual".
  const couponPro = current === "PRO" && billing.data?.provider === "COUPON";

  if (current === "PRO" && !couponPro) {
    const provider = billing.data?.provider;
    const prepaid = provider === "CRYPTO" || provider === "PIX";
    const until = billing.data?.cancelAtPeriodEnd
      ? formatDate(billing.data.currentPeriodEnd)
      : null;

    // Pré-pago: renova pelo meio usado (botão principal) ou pelo outro.
    const pixRenew = canPayPix
      ? { key: "pix", label: "Renew with Pix", open: () => setPixOpen(true) }
      : null;
    const usdcRenew = canPayCrypto
      ? {
          key: "usdc",
          label: "Renew with USDC",
          open: () => setCryptoOpen(true),
        }
      : null;
    const renew = prepaid
      ? (provider === "PIX"
          ? [pixRenew, usdcRenew]
          : [usdcRenew, pixRenew]
        ).filter((r) => r !== null)
      : [];

    return (
      <div className="flex w-full flex-col gap-2">
        {renew.length > 0 ? (
          renew.map((r, i) => (
            <Button
              key={r.key}
              variant={i === 0 ? "primary" : "secondary"}
              className={i === 0 ? undefined : "h-11 p-0"}
              onClick={r.open}
            >
              {r.label}
            </Button>
          ))
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
            {provider === "STRIPE" && canPayCrypto && (
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
            {provider === "STRIPE" && canPayPix && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => setPixOpen(true)}
                  className="font-semibold text-principal-11 hover:underline"
                >
                  Extend with Pix
                </button>
              </>
            )}
          </p>
        )}
        {modals}
      </div>
    );
  }

  // Ainda buscando = skeleton na linha do modal; sem oferta = linha some.
  const methodState = (
    q: { isPending: boolean; fetchStatus: string },
    available: boolean,
  ): MethodState =>
    available
      ? "available"
      : q.isPending && q.fetchStatus !== "idle"
        ? "loading"
        : "unavailable";

  const couponUntil = couponPro
    ? formatDate(billing.data?.currentPeriodEnd ?? null)
    : null;

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
          setMethodOpen(true);
        }}
      >
        {couponPro ? "Continue with Pro" : "Choose this plan"}
      </Button>
      {couponPro && couponUntil && (
        <p className="text-center text-sm text-gray-11">
          Free Pro (coupon) until {couponUntil}
        </p>
      )}
      <PaymentMethodModal
        open={methodOpen}
        onClose={closeMethod}
        cardNote={
          couponPro
            ? "Subscribing by card starts now and ends your free coupon period. Crypto and Pix add days after it."
            : undefined
        }
        cardPending={checkout.isPending}
        onCard={() => checkout.mutate()}
        usdc={{
          state: methodState(cryptoOptions, canPayCrypto),
          periodDays: cryptoOptions.data?.periodDays ?? 30,
          onChoose: () => {
            setMethodOpen(false);
            setCryptoOpen(true);
          },
        }}
        pix={{
          state: methodState(pixOptions, canPayPix),
          periodDays: pixOptions.data?.periodDays ?? 30,
          quoteBrlCents: pixOptions.data?.quoteBrlCents ?? null,
          onChoose: () => {
            setMethodOpen(false);
            setPixOpen(true);
          },
        }}
      />
      {modals}
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
