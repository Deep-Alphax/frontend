"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  BILLING_DETAILS_KEY,
  createPixPayment,
  getPixPayment,
  PLAN_KEY,
  type PixPayment,
} from "@/lib/api/billing";
import { getApiErrorMessage } from "@/lib/api/client";
import { PRO_PRICE_USD } from "@/lib/billing/price";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";
import { formatBrl, formatFxRate } from "@/lib/pix/format";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/components/plans/crypto/walletUi";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/*
 * Pré-pago em Pix pela Vai de Cripto: gerar → QR (e copia e cola) →
 * confirmado. Quem decide se pagou é o backend, consultando a Vai de Cripto;
 * o front só consulta o status da cobrança. Nenhum dado do pagador é pedido.
 */

const POLL_MS = 5_000;
/** O QR é gerado em segundo plano: enquanto não sai, consulta mais rápido. */
const QR_POLL_MS = 2_000;

export function PixPayModal({
  open,
  quoteBrlCents,
  amountUsdCents = null,
  periodDays,
  onClose,
}: {
  open: boolean;
  /** Valor de agora em reais (só exibição; a cobrança trava o seu). */
  quoteBrlCents: number | null;
  /** Preço em centavos de US$ vindo do servidor; ausente = preço de vitrine. */
  amountUsdCents?: number | null;
  periodDays: number;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const qc = useQueryClient();
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Fechar zera o fluxo. Um QR já aberto e pago continua sendo creditado pelo
  // servidor — o modal não é o que garante o crédito.
  const close = useCallback(() => {
    setPaymentId(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const create = useMutation({
    mutationFn: createPixPayment,
    onSuccess: (p) => {
      qc.setQueryData(["pix-payment", p.id], p);
      setPaymentId(p.id);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const payment = useQuery({
    queryKey: ["pix-payment", paymentId],
    queryFn: () => getPixPayment(paymentId!),
    enabled: open && paymentId !== null,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d?.status !== "PENDING") return false;
      return d.qrCopyPaste ? POLL_MS : QR_POLL_MS;
    },
  });

  const confirmed = payment.data?.status === "CONFIRMED";
  useEffect(() => {
    if (!confirmed) return;
    void qc.invalidateQueries({ queryKey: PLAN_KEY });
    void qc.invalidateQueries({ queryKey: BILLING_DETAILS_KEY });
  }, [confirmed, qc]);

  if (typeof document === "undefined") return null;

  const status = payment.data?.status;
  const pending = status === "PENDING";
  const generating = paymentId !== null && (!payment.data || (pending && !payment.data.qrCopyPaste));

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
            onClick={close}
            className="absolute inset-0 cursor-default bg-gray-1/80"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Pay with Pix"
            className="relative flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl"
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: DURATION.emphasis, ease: EASE.out }}
          >
            <ScrollArea viewportClassName="max-h-[calc(100dvh-2rem)]">
              <div className="border-b border-gray-6 px-5 py-4">
                <h2 className="text-lg font-semibold leading-[1.2] text-gray-12">
                  Pay with Pix
                </h2>
                <p className="mt-1 text-sm text-gray-11">
                  {payment.data
                    ? formatBrl(payment.data.amountBrlCents)
                    : quoteBrlCents
                      ? formatBrl(quoteBrlCents)
                      : `US$ ${amountUsdCents ? amountUsdCents / 100 : PRO_PRICE_USD} in BRL`}{" "}
                  · {periodDays} days of Pro · doesn&apos;t renew
                </p>
              </div>

              {!paymentId && (
                <StartStep
                  quoteBrlCents={quoteBrlCents}
                  submitting={create.isPending}
                  onStart={() => create.mutate()}
                />
              )}

              {generating && (
                <SkeletonGroup
                  className="flex flex-col items-center gap-4 px-5 py-8"
                  label="Generating QR code"
                >
                  <Skeleton className="size-52 rounded-lg" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </SkeletonGroup>
              )}

              {payment.data && pending && !generating && <PayStep payment={payment.data} />}
              {payment.data && !pending && <Outcome payment={payment.data} />}

              <div className="flex gap-2 border-t border-gray-6 p-4">
                {paymentId && (status === "EXPIRED" || status === "FAILED") ? (
                  <button
                    type="button"
                    onClick={() => setPaymentId(null)}
                    className={SECONDARY_BTN}
                  >
                    Start again
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={close}
                  className={confirmed ? PRIMARY_BTN : SECONDARY_BTN}
                >
                  {confirmed ? "Done" : "Close"}
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

function StartStep({
  quoteBrlCents,
  submitting,
  onStart,
}: {
  quoteBrlCents: number | null;
  submitting: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <p className="text-sm text-gray-11">
        Pay from any Brazilian bank account. The amount is locked when the QR code is generated.
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={submitting}
        className={cn(PRIMARY_BTN, "w-full flex-none disabled:cursor-not-allowed")}
      >
        {submitting
          ? "Generating QR code…"
          : quoteBrlCents
            ? `Generate Pix · ${formatBrl(quoteBrlCents)}`
            : "Generate Pix"}
      </button>
    </div>
  );
}

function PayStep({ payment }: { payment: PixPayment }) {
  const copy = useCallback(async () => {
    if (!payment.qrCopyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.qrCopyPaste);
      toast.success("Pix code copied");
    } catch {
      toast.error("Couldn't copy. Select the code and copy it manually.");
    }
  }, [payment.qrCopyPaste]);

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-5">
      {payment.qrImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor
        <img
          src={payment.qrImage}
          alt="Pix QR code"
          width={208}
          height={208}
          className="size-52 rounded-lg bg-white p-2"
        />
      ) : null}

      <p className="text-center text-sm text-gray-11">
        {formatBrl(payment.amountBrlCents)} · US$ {(payment.amountUsdCents / 100).toFixed(0)} at R${" "}
        {formatFxRate(payment.fxRate)}
      </p>

      {payment.qrCopyPaste ? (
        <div className="flex w-full flex-col gap-2">
          <label htmlFor="pix-copy-paste" className="text-sm text-gray-12">
            Pix copy and paste
          </label>
          <div className="flex gap-2">
            <input
              id="pix-copy-paste"
              readOnly
              value={payment.qrCopyPaste}
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-3 px-3 font-mono text-sm text-gray-12 outline-none"
            />
            <button type="button" onClick={copy} className={cn(PRIMARY_BTN, "flex-none")}>
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-sm text-gray-11" aria-live="polite">
        <span
          className="size-4 animate-spin rounded-full border-2 border-gray-6 border-t-principal-9"
          aria-hidden="true"
        />
        Waiting for payment…
      </div>
      <p className="text-center text-xs text-gray-11">
        Use only this code — it works once. You can close this window after paying; we&apos;ll
        credit it automatically.
      </p>
    </div>
  );
}

function Outcome({ payment }: { payment: PixPayment }) {
  const copy: Record<Exclude<PixPayment["status"], "PENDING">, { title: string; body: string }> = {
    CONFIRMED: {
      title: "Payment received",
      body: `${payment.periodDays} days of Pro added.`,
    },
    EXPIRED: {
      title: "This QR code expired",
      body: "Start again to get a new one. If you already paid, it will still be credited.",
    },
    FAILED: {
      title: "We couldn't process this payment",
      body: "If money left your account, contact support — we'll sort it out.",
    },
    REFUNDED: {
      title: "This payment was refunded",
      body: "The Pro days from it were removed.",
    },
  };
  const { title, body } = copy[payment.status as Exclude<PixPayment["status"], "PENDING">];
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-8 text-center" aria-live="polite">
      <h3 className="text-xl font-semibold text-gray-12">{title}</h3>
      <p className="text-sm text-gray-11">{body}</p>
    </div>
  );
}
