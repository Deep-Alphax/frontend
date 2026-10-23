"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";

import { CancelIcon } from "@/components/icons/hugeicons";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { DepositView } from "@/lib/api/deposits";
import { CHAIN_LABEL, isAfterPayment } from "@/lib/deposits/format";
import {
  useCreateDeposit,
  useDeposit,
  useDepositOptions,
  useSeedDeposit,
} from "@/lib/deposits/useDeposits";
import { DURATION, EASE } from "@/lib/motion";
import { formatBrl } from "@/lib/pix/format";
import { useDepositModal, type DepositPreset } from "@/lib/store/depositModal";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/components/plans/crypto/walletUi";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { DepositForm, DepositFormSkeleton } from "@/components/deposits/DepositForm";
import {
  ExpiredStep,
  PayStep,
  ProgressStep,
  StatusSkeleton,
} from "@/components/deposits/DepositStatusView";

/*
 * Depósito via Pix: o usuário paga em reais e recebe a cripto escolhida NA
 * CARTEIRA DELE (contrato em `lib/api/deposits.ts`). Um modal, três etapas:
 * escolher → pagar (QR) → acompanhar a entrega.
 *
 * Mesmo shell dos modais de pagamento (`PixPayModal`/`CryptoPayModal`: portal +
 * framer-motion, sem Radix Dialog — o projeto não tem). Fechar no meio é
 * permitido: o servidor segue entregando e a lista "Recent deposits" reabre.
 *
 * Carregado sob demanda pelo `DepositButton` (header em toda página não paga
 * por este chunk até o primeiro clique).
 */

export default function DepositModal() {
  const open = useDepositModal((s) => s.open);
  const preset = useDepositModal((s) => s.preset);
  const session = useDepositModal((s) => s.session);
  const close = useDepositModal((s) => s.close);
  const reduce = useReducedMotion();

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="deposit-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION.base, ease: EASE.standard }}
        >
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={close}
            className="absolute inset-0 cursor-default bg-gray-1/80"
          />
          {/* `key` por abertura: cada abertura nasce limpa (preset novo inclusive). */}
          <DepositDialog key={session} preset={preset} onClose={close} reduce={!!reduce} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DepositDialog({
  preset,
  onClose,
  reduce,
}: {
  preset: DepositPreset | null;
  onClose: () => void;
  reduce: boolean;
}) {
  const [depositId, setDepositId] = useState<string | null>(null);
  /** O prazo do QR venceu no relógio local antes de o servidor dizer EXPIRED. */
  const [expiredLocally, setExpiredLocally] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Esc com um dropdown aberto fecha SÓ o dropdown (mesma solução do
  // CryptoPayModal: o Radix trata o Esc antes e avisa "fechou" no mesmo tick).
  const selectOpen = useRef(false);
  const onSelectOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) selectOpen.current = true;
    else setTimeout(() => (selectOpen.current = false), 0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !selectOpen.current) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco entra no dialog e volta para quem abriu ao fechar.
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [onClose]);

  const options = useDepositOptions(true);
  const create = useCreateDeposit();
  const seed = useSeedDeposit();
  const deposit = useDeposit(depositId);
  const d = deposit.data;

  const openDeposit = (item: DepositView) => {
    seed(item);
    setDepositId(item.id);
  };
  const backToForm = () => {
    setDepositId(null);
    setExpiredLocally(null);
  };
  const onExpired = useCallback(() => setExpiredLocally(depositId), [depositId]);

  const expired = d?.status === "EXPIRED" || (d?.status === "PENDING" && expiredLocally === d.id);
  const delivered = d?.status === "DELIVERED";

  let subtitle = "Pay in BRL and receive crypto in your own wallet.";
  if (d) subtitle = `${formatBrl(d.amountBrlCents)} → ${d.symbol} on ${CHAIN_LABEL[d.chain]}`;

  const showForm = depositId === null;

  return (
    <motion.div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-title"
      className="relative flex max-h-full w-full max-w-[440px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl outline-none"
      initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
      transition={{ duration: DURATION.emphasis, ease: EASE.out }}
    >
      <ScrollArea viewportClassName="max-h-[calc(100dvh-2rem)]">
        <div className="flex items-start gap-3 border-b border-gray-6 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id="deposit-title" className="text-lg font-semibold leading-[1.2] text-gray-12">
              Deposit with Pix
            </h2>
            <p className="mt-1 truncate text-sm text-gray-11">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close deposit"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-11 transition-colors hover:bg-gray-4 hover:text-gray-12"
          >
            <CancelIcon className="size-5" />
          </button>
        </div>

        {/* Formulário fica montado (escondido) durante o pagamento: "Start
            again" e "New deposit" voltam com o que o usuário já tinha escolhido. */}
        <div hidden={!showForm}>
          {options.isPending ? (
            <DepositFormSkeleton />
          ) : options.isError ? (
            <div className="flex flex-col gap-4 px-5 py-6" role="alert">
              <p className="text-sm text-gray-11">{getApiErrorMessage(options.error, "Couldn't load deposit options.")}</p>
              <button type="button" onClick={() => void options.refetch()} className={cn(SECONDARY_BTN, "w-full flex-none")}>
                Try again
              </button>
            </div>
          ) : !options.data.enabled ? (
            <div className="flex flex-col items-center gap-2 px-5 py-10 text-center" role="status">
              <h3 className="text-lg font-semibold text-gray-12">Deposits are unavailable right now</h3>
              <p className="text-sm text-gray-11">Pix deposits are paused for the moment. Please try again later.</p>
            </div>
          ) : (
            <DepositForm
              options={options.data}
              preset={preset}
              submitting={create.isPending}
              onSelectOpenChange={onSelectOpenChange}
              onOpenDeposit={openDeposit}
              onSubmit={(req) =>
                create.mutate(req, {
                  onSuccess: (created) => setDepositId(created.id),
                  onError: (err) => toast.error(getApiErrorMessage(err, "Couldn't generate the Pix. Try again.")),
                })
              }
            />
          )}
        </div>

        {!showForm && (
          <>
            {!d ? (
              deposit.isError ? (
                <p role="alert" className="px-5 py-8 text-center text-sm text-gray-11">
                  {getApiErrorMessage(deposit.error, "Couldn't load this deposit.")}
                </p>
              ) : (
                <StatusSkeleton />
              )
            ) : expired ? (
              <ExpiredStep onRestart={backToForm} />
            ) : d.status === "PENDING" ? (
              <PayStep deposit={d} onExpired={onExpired} />
            ) : isAfterPayment(d.status) ? (
              <ProgressStep deposit={d} />
            ) : null}

            <div className="flex gap-2 border-t border-gray-6 p-4">
              {!expired && (
                <button type="button" onClick={backToForm} className={SECONDARY_BTN}>
                  New deposit
                </button>
              )}
              <button type="button" onClick={onClose} className={delivered ? PRIMARY_BTN : SECONDARY_BTN}>
                {delivered ? "Done" : "Close"}
              </button>
            </div>
          </>
        )}
      </ScrollArea>
    </motion.div>
  );
}
