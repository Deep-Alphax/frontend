"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { PRO_PRICE_USD } from "@/lib/billing/price";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";
import { formatBrl } from "@/lib/pix/format";
import { SECONDARY_BTN } from "@/components/plans/crypto/walletUi";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/*
 * Escolha do meio de pagamento do PRO: cartão (assinatura no Stripe), USDC ou
 * Pix (pré-pagos, não renovam). Este modal só escolhe — cada meio segue no seu
 * próprio fluxo (Checkout do Stripe, `CryptoPayModal`, `PixPayModal`).
 *
 * As opções de USDC e Pix vêm do servidor; enquanto carregam, a linha vira
 * skeleton. Meio desligado no servidor (ou bloqueado) simplesmente não aparece.
 */

/** Estado de um meio pré-pago, como o `PlanCta` resolve a partir das queries. */
export type MethodState = "loading" | "available" | "unavailable";

export function PaymentMethodModal({
  open,
  onClose,
  cardPending,
  onCard,
  usdc,
  pix,
}: {
  open: boolean;
  onClose: () => void;
  /** O Checkout do Stripe está sendo criado. */
  cardPending: boolean;
  onCard: () => void;
  usdc: { state: MethodState; periodDays: number; onChoose: () => void };
  pix: {
    state: MethodState;
    periodDays: number;
    /** Valor em reais de agora (só exibição); `null` = ainda sem cotação. */
    quoteBrlCents: number | null;
    onChoose: () => void;
  };
}) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE.standard }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-gray-1/80"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Choose how to pay"
            className="relative flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl"
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: DURATION.emphasis, ease: EASE.out }}
          >
            <ScrollArea viewportClassName="max-h-[calc(100dvh-2rem)]">
              <div className="border-b border-gray-6 px-5 py-4">
                <h2 className="text-lg font-semibold leading-[1.2] text-gray-12">
                  Choose how to pay
                </h2>
                <p className="mt-1 text-sm text-gray-11">
                  Pro plan · US$ {PRO_PRICE_USD}
                </p>
              </div>

              <div className="flex flex-col gap-2 p-4">
                <MethodRow
                  title={cardPending ? "Opening checkout…" : "Card"}
                  detail="Monthly subscription via Stripe · renews automatically"
                  disabled={cardPending}
                  onClick={onCard}
                />
                <PrepaidRow
                  state={usdc.state}
                  title="USDC"
                  detail={`Pay from your wallet · ${usdc.periodDays} days · doesn't renew`}
                  disabled={cardPending}
                  onClick={usdc.onChoose}
                />
                <PrepaidRow
                  state={pix.state}
                  title="Pix"
                  detail={`${
                    pix.quoteBrlCents
                      ? formatBrl(pix.quoteBrlCents)
                      : "Pay in BRL"
                  } · ${pix.periodDays} days · doesn't renew`}
                  disabled={cardPending}
                  onClick={pix.onChoose}
                />
              </div>

              <div className="flex border-t border-gray-6 p-4">
                <button
                  type="button"
                  onClick={onClose}
                  className={SECONDARY_BTN}
                >
                  Cancel
                </button>
              </div>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function PrepaidRow({
  state,
  ...row
}: { state: MethodState } & Parameters<typeof MethodRow>[0]) {
  if (state === "unavailable") return null;
  if (state === "loading") {
    return (
      <SkeletonGroup
        label={`Loading ${row.title}`}
        className="flex flex-col gap-2 rounded-lg border border-gray-6 px-4 py-3"
      >
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3.5 w-56" />
      </SkeletonGroup>
    );
  }
  return <MethodRow {...row} />;
}

function MethodRow({
  title,
  detail,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-gray-6 bg-gray-3 px-4 py-3 text-left",
        "outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-base font-semibold leading-[1.1] text-gray-12">
          {title}
        </span>
        <span className="text-sm text-gray-11">{detail}</span>
      </span>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="size-5 flex-none text-gray-11"
      >
        <path
          d="m8 5 5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
