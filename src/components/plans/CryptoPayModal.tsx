"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import toast from "react-hot-toast";

import {
  BILLING_DETAILS_KEY,
  createCryptoPayment,
  getCryptoPayment,
  isEvmChain,
  PLAN_KEY,
  submitCryptoPayment,
  type CryptoChain,
  type CryptoPayment,
  type SentCryptoTx,
} from "@/lib/api/billing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { getApiErrorMessage } from "@/lib/api/client";
import { clearSentTx, loadSentTx, saveSentTx } from "@/lib/crypto/sentTx";
import { DURATION, EASE } from "@/lib/motion";
import { cn } from "@/lib/cn";
import { PRIMARY_BTN, SECONDARY_BTN } from "@/components/plans/crypto/walletUi";

/*
 * Pré-pago em USDC pela carteira do usuário. Uma etapa por vez: rede →
 * carteira → pagar → confirmando → confirmado.
 *
 * A carteira assina e transmite a transferência; o front só repassa o hash
 * (e, nas EVM, a assinatura de posse da carteira) ao servidor. Quem decide se
 * pagou é o backend, lendo a transação na rede (contrato do USDC, destino,
 * valor, confirmações) — o hash vindo do navegador nunca é prova por si só.
 *
 * As libs de carteira (wagmi/viem para EVM, web3.js para Solana) ficam em
 * chunks próprios, carregados só quando a etapa de pagar abre. O navegador não
 * fala com RPC nenhum: tudo passa pelo provider da carteira ou pela nossa API.
 */

const EvmWalletPay = lazy(() => import("@/components/plans/crypto/EvmWalletPay"));
const SolanaWalletPay = lazy(() => import("@/components/plans/crypto/SolanaWalletPay"));

const CHAIN_LABEL: Record<CryptoChain, string> = {
  SOLANA: "Solana",
  ETHEREUM: "Ethereum",
  BASE: "Base",
  ARBITRUM: "Arbitrum",
  OPTIMISM: "Optimism",
  POLYGON: "Polygon",
  BSC: "BNB Chain",
};

/** Nota curta por rede, dentro do próprio item do seletor. */
const CHAIN_NOTE: Partial<Record<CryptoChain, string>> = {
  ETHEREUM: "higher fee",
  BSC: "Binance-Peg",
};

/** Consulta de status enquanto a cobrança está aberta. */
const POLL_MS = 5_000;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * O servidor leu a transação e ela NÃO paga esta cobrança (4xx de validação).
 * Rede caída, 5xx, timeout e 429 não são definitivos: o hash continua guardado
 * para reenviar — o dinheiro pode já ter saído.
 */
function isDefinitiveRejection(error: unknown): boolean {
  if (!(error instanceof AxiosError)) return false;
  const status = error.response?.status ?? 0;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export function CryptoPayModal({
  open,
  chains,
  amount,
  periodDays,
  onClose,
}: {
  open: boolean;
  /** Redes ligadas no servidor. */
  chains: CryptoChain[];
  /** Preço base exibido na escolha de rede ("50"). */
  amount: string;
  periodDays: number;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const qc = useQueryClient();
  const [paymentId, setPaymentId] = useState<string | null>(null);

  // Fechar zera o fluxo: reabrir começa na escolha de rede. Uma cobrança já
  // aberta não se perde — o servidor a devolve de novo ao escolher a mesma rede
  // (inclusive a que está confirmando, que então aparece como "confirmando").
  const close = useCallback(() => {
    setPaymentId(null);
    onClose();
  }, [onClose]);

  // Esc com o dropdown de rede aberto fecha SÓ o dropdown. O Radix trata o Esc
  // em captura (antes deste listener) e já avisa "fechou"; por isso a baixa do
  // flag vai para o próximo tick — senão o mesmo Esc fecharia o modal junto.
  const selectOpen = useRef(false);
  const onSelectOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) selectOpen.current = true;
    else setTimeout(() => (selectOpen.current = false), 0);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !selectOpen.current) close();
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
    mutationFn: createCryptoPayment,
    onSuccess: (p) => {
      qc.setQueryData(["crypto-payment", p.id], p);
      setPaymentId(p.id);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const payment = useQuery({
    queryKey: ["crypto-payment", paymentId],
    queryFn: () => getCryptoPayment(paymentId!),
    enabled: open && paymentId !== null,
    // Para de consultar assim que confirma (ou expira de vez).
    refetchInterval: (q) => (q.state.data?.status === "PENDING" ? POLL_MS : false),
  });

  // Cobrança cuja transação em confirmação o servidor descartou (aviso).
  const [lostTx, setLostTx] = useState<string | null>(null);

  // O id vai nas variáveis: o erro/estado de um envio só vale para a cobrança
  // em que ele aconteceu (trocar de rede ou reabrir não herda erro antigo).
  const submit = useMutation({
    mutationFn: (v: { id: string; tx: SentCryptoTx }) => submitCryptoPayment(v.id, v.tx),
    onSuccess: (p, v) => {
      clearSentTx(v.id);
      qc.setQueryData(["crypto-payment", p.id], p);
    },
    onError: (error, v) => {
      if (isDefinitiveRejection(error)) clearSentTx(v.id);
    },
  });
  const submitHere = submit.variables?.id === paymentId;
  // Transação que a carteira já transmitiu e o servidor ainda não registrou
  // (enviando, ou falhou sem ser recusa definitiva). Enquanto existir, NUNCA se
  // oferece pagar de novo — seria pagar em dobro.
  const sentHere =
    submitHere &&
    (submit.isPending || (submit.isError && !isDefinitiveRejection(submit.error)))
      ? submit.variables!.tx
      : null;
  const { mutate: submitMutate } = submit;

  const onSent = useCallback(
    (tx: SentCryptoTx) => {
      if (!paymentId) return;
      // Grava ANTES do POST: se a aba cair agora, reabrir reenvia daqui.
      saveSentTx(paymentId, tx);
      setLostTx(null);
      submitMutate({ id: paymentId, tx });
    },
    [paymentId, submitMutate],
  );

  // Retomada: a carteira devolveu o hash numa visita anterior, mas o servidor
  // nunca o recebeu (aba fechada, rede caiu). Reenvia uma vez por cobrança.
  const resumed = useRef(new Set<string>());
  const data = payment.data;
  useEffect(() => {
    if (!data || resumed.current.has(data.id)) return;
    if (data.status !== "PENDING") {
      clearSentTx(data.id);
      return;
    }
    resumed.current.add(data.id);
    if (data.submittedTxHash) {
      clearSentTx(data.id);
      return;
    }
    const stored = loadSentTx(data.id);
    if (!stored) return;
    submitMutate({ id: data.id, tx: stored });
  }, [data, submitMutate]);

  const confirmed = payment.data?.status === "CONFIRMED";
  useEffect(() => {
    if (!confirmed) return;
    void qc.invalidateQueries({ queryKey: PLAN_KEY });
    void qc.invalidateQueries({ queryKey: BILLING_DETAILS_KEY });
  }, [confirmed, qc]);

  // O servidor descartou a transação em confirmação (não achou/não pagava):
  // a cobrança volta a aceitar pagamento, com um aviso.
  const lastSubmitted = useRef<{ id: string; hash: string | null } | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = lastSubmitted.current;
    if (prev?.id === data.id && prev.hash && !data.submittedTxHash && data.status === "PENDING") {
      setLostTx(data.id);
    }
    lastSubmitted.current = { id: data.id, hash: data.submittedTxHash };
  }, [data]);

  if (typeof document === "undefined") return null;

  const locked = !!payment.data?.submittedTxHash || sentHere !== null;

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
            aria-label="Pay with USDC"
            className="relative flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl"
            initial={reduce ? false : { opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: DURATION.emphasis, ease: EASE.out }}
          >
            {/* Conteúdo inteiro rola dentro do dialog. O teto é a altura da tela
                menos o p-4 do container; vai no VIEWPORT (no Root não limitaria). */}
            <ScrollArea viewportClassName="max-h-[calc(100dvh-2rem)]">
              <div className="border-b border-gray-6 px-5 py-4">
                <h2 className="text-lg font-semibold leading-[1.2] text-gray-12">
                  Pay with USDC
                </h2>
                <p className="mt-1 text-sm text-gray-11">
                  {amount} USDC · {periodDays} days of Pro · doesn&apos;t renew
                </p>
              </div>

              {!paymentId && (
                <ChainPicker
                  chains={chains}
                  pending={create.isPending ? create.variables : undefined}
                  onPick={(chain) => create.mutate(chain)}
                  onOpenChange={onSelectOpenChange}
                />
              )}

              {paymentId && payment.data && !confirmed && (
                <PayStep
                  payment={payment.data}
                  checkedAt={payment.dataUpdatedAt}
                  sent={sentHere}
                  submitting={submitHere && submit.isPending}
                  submitError={
                    submitHere && submit.isError ? getApiErrorMessage(submit.error) : null
                  }
                  lostTx={lostTx === paymentId}
                  onSent={onSent}
                  onRetry={() => sentHere && paymentId && submitMutate({ id: paymentId, tx: sentHere })}
                />
              )}

              {paymentId && !payment.data && (
                <p className="px-5 py-8 text-center text-sm text-gray-11">Loading…</p>
              )}

              {confirmed && payment.data && <Confirmed payment={payment.data} />}

              <div className="flex gap-2 border-t border-gray-6 p-4">
                {paymentId && !confirmed && !locked ? (
                  <button
                    type="button"
                    onClick={() => setPaymentId(null)}
                    className={SECONDARY_BTN}
                  >
                    Back
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

function ChainPicker({
  chains,
  pending,
  onPick,
  onOpenChange,
}: {
  chains: CryptoChain[];
  pending?: CryptoChain;
  onPick: (chain: CryptoChain) => void;
  /** Avisa o modal quando o dropdown abre/fecha (o Esc é do dropdown, não do modal). */
  onOpenChange: (open: boolean) => void;
}) {
  const [chain, setChain] = useState<CryptoChain | undefined>(undefined);

  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      <Select
        value={chain}
        onValueChange={(v) => setChain(v as CryptoChain)}
        onOpenChange={onOpenChange}
        disabled={pending !== undefined}
      >
        <SelectTrigger aria-label="Network">
          <SelectValue placeholder="Select a network" />
        </SelectTrigger>
        <SelectContent>
          {chains.map((c) => (
            <SelectItem key={c} value={c}>
              USDC on {CHAIN_LABEL[c]}
              {CHAIN_NOTE[c] && <span className="text-gray-11"> · {CHAIN_NOTE[c]}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <button
        type="button"
        disabled={!chain || pending !== undefined}
        onClick={() => chain && onPick(chain)}
        className={cn(PRIMARY_BTN, "w-full flex-none disabled:cursor-not-allowed")}
      >
        {pending ? "Preparing…" : "Continue"}
      </button>
    </div>
  );
}

function PayStep({
  payment,
  checkedAt,
  sent,
  submitting,
  submitError,
  lostTx,
  onSent,
  onRetry,
}: {
  payment: CryptoPayment;
  /** Hora da última consulta de status — o polling de 5s serve de relógio. */
  checkedAt: number;
  /** Transação já transmitida pela carteira, ainda não registrada no servidor. */
  sent: SentCryptoTx | null;
  submitting: boolean;
  /** Erro ao registrar o envio, já em texto para o usuário. */
  submitError: string | null;
  /** O servidor descartou a transação que estava confirmando. */
  lostTx: boolean;
  onSent: (tx: SentCryptoTx) => void;
  onRetry: () => void;
}) {
  const network = CHAIN_LABEL[payment.chain];

  // Registrado no servidor: só faltam confirmações.
  if (payment.submittedTxHash) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-8 text-center" aria-live="polite">
        <span
          className="size-6 animate-spin rounded-full border-2 border-gray-6 border-t-principal-9"
          aria-hidden="true"
        />
        <p className="text-base font-semibold text-gray-12">Confirming on {network}…</p>
        <p className="text-sm text-gray-11">
          You can close this window — we&apos;ll credit it automatically.
        </p>
      </div>
    );
  }

  // A carteira transmitiu; o servidor ainda não registrou. Nunca oferece pagar
  // de novo aqui — o dinheiro pode já ter saído.
  if (sent) {
    const failed = submitError !== null && !submitting;
    return (
      <div className="flex flex-col gap-3 px-5 py-6" aria-live="polite">
        <p className="text-center text-sm font-semibold text-gray-12">
          {failed ? "Payment sent — we couldn't register it yet." : "Payment sent — registering…"}
        </p>
        {failed && (
          <>
            <button type="button" onClick={onRetry} className={cn(PRIMARY_BTN, "w-full flex-none")}>
              Retry
            </button>
            <p role="alert" className="text-sm text-danger-11">
              {submitError} Don&apos;t pay again.
            </p>
          </>
        )}
      </div>
    );
  }

  // Janela vencida sem envio: não oferece pagar numa cobrança velha.
  if (new Date(payment.expiresAt).getTime() < checkedAt) {
    return (
      <p className="px-5 py-6 text-sm text-gray-11" aria-live="polite">
        This payment expired. Go back to start a new one.
      </p>
    );
  }

  const WalletPay = isEvmChain(payment.chain) ? EvmWalletPay : SolanaWalletPay;
  const error = lostTx
    ? "We couldn't verify your last transaction. If USDC left your wallet, contact support."
    : submitError;
  return (
    <div className="px-5 py-5">
      <Suspense fallback={<p className="text-sm text-gray-11">Loading wallets…</p>}>
        <WalletPay
          payment={payment}
          network={network}
          busy={submitting}
          error={error}
          onSent={onSent}
        />
      </Suspense>
    </div>
  );
}

function Confirmed({ payment }: { payment: CryptoPayment }) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-8 text-center" aria-live="polite">
      <h3 className="text-xl font-semibold text-gray-12">Payment received</h3>
      <p className="text-sm text-gray-11">
        {payment.periodDays} days of Pro added
        {payment.confirmedAt ? ` on ${formatDate(payment.confirmedAt)}` : ""}.
      </p>
    </div>
  );
}
