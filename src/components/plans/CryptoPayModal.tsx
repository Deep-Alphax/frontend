"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  BILLING_DETAILS_KEY,
  createCryptoPayment,
  getCryptoPayment,
  PLAN_KEY,
  isEvmChain,
  submitCryptoPayment,
  type CryptoChain,
  type CryptoPayment,
} from "@/lib/api/billing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { TextField } from "@/components/ui/TextField";
import { getApiErrorMessage } from "@/lib/api/client";
import { DURATION, EASE } from "@/lib/motion";
import { cn } from "@/lib/cn";

/*
 * Pré-pago em USDC. Três estados: escolher a rede → pagar (QR + valor) →
 * confirmado.
 *
 * O front não fala com blockchain nenhuma: o servidor reserva a cobrança, gera
 * o QR e confirma o pagamento varrendo a rede. Aqui só se consulta o status —
 * então não há carteira conectada, assinatura nem RPC no navegador.
 */

const CHAIN_LABEL: Record<CryptoChain, string> = {
  SOLANA: "Solana",
  ETHEREUM: "Ethereum",
  BASE: "Base",
  ARBITRUM: "Arbitrum",
  OPTIMISM: "Optimism",
  POLYGON: "Polygon",
  BSC: "BNB Chain",
};

/** Nota por rede no seletor — o que o usuário precisa saber antes de escolher. */
const CHAIN_NOTE: Partial<Record<CryptoChain, string>> = {
  ETHEREUM: "higher network fee",
  BSC: "Binance-Peg USDC (BEP-20)",
};

/** Consulta de status enquanto a cobrança está aberta. */
const POLL_MS = 5_000;

const SECONDARY_BTN = cn(
  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-4",
  "border border-gray-6 bg-gray-3 text-base font-semibold leading-[1.1] text-gray-12",
  "outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
);
const PRIMARY_BTN = cn(
  "flex h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-4",
  "bg-principal-9 text-base font-semibold leading-[1.1] text-gray-1 hover:bg-principal-10",
  "outline-none focus-visible:ring-2 focus-visible:ring-principal-11 disabled:opacity-60",
);

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Could not copy — select and copy it manually.");
  }
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
  // aberta não se perde — o servidor a devolve de novo ao escolher a mesma rede.
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

  // "Enviei": grava a carteira e o servidor procura na hora. A resposta já é a
  // cobrança atualizada — entra direto no cache, sem esperar o próximo polling.
  // O id vai nas variáveis: o erro/estado de um envio só vale para a cobrança
  // em que ele aconteceu (trocar de rede ou reabrir não herda erro antigo).
  const submit = useMutation({
    mutationFn: (v: { id: string; payer: string }) => submitCryptoPayment(v.id, v.payer),
    onSuccess: (p) => qc.setQueryData(["crypto-payment", p.id], p),
  });
  const submitHere = submit.variables?.id === paymentId;

  const confirmed = payment.data?.status === "CONFIRMED";
  useEffect(() => {
    if (!confirmed) return;
    void qc.invalidateQueries({ queryKey: PLAN_KEY });
    void qc.invalidateQueries({ queryKey: BILLING_DETAILS_KEY });
  }, [confirmed, qc]);

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
                <p className="mt-1 text-sm leading-[1.4] text-gray-11">
                  Prepaid: {periodDays} days of Pro. It does not renew — when it ends
                  your account goes back to Free until you pay again.
                </p>
              </div>

              {!paymentId && (
                <ChainPicker
                  chains={chains}
                  amount={amount}
                  pending={create.isPending ? create.variables : undefined}
                  onPick={(chain) => create.mutate(chain)}
                  onOpenChange={onSelectOpenChange}
                />
              )}

              {paymentId && payment.data && !confirmed && (
                <PayStep
                  payment={payment.data}
                  evmChains={chains.filter(isEvmChain)}
                  checkedAt={payment.dataUpdatedAt}
                  submitting={submitHere && submit.isPending}
                  submitError={
                    submitHere && submit.isError ? getApiErrorMessage(submit.error) : null
                  }
                  onSubmit={(payer) => submit.mutate({ id: paymentId, payer })}
                />
              )}

              {paymentId && !payment.data && (
                <p className="px-5 py-8 text-center text-sm text-gray-11">Loading…</p>
              )}

              {confirmed && payment.data && <Confirmed payment={payment.data} />}

              <div className="flex gap-2 border-t border-gray-6 p-4">
                {paymentId && !confirmed ? (
                  <button
                    type="button"
                    onClick={() => setPaymentId(null)}
                    className={SECONDARY_BTN}
                  >
                    Change network
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
  amount,
  pending,
  onPick,
  onOpenChange,
}: {
  chains: CryptoChain[];
  amount: string;
  pending?: CryptoChain;
  onPick: (chain: CryptoChain) => void;
  /** Avisa o modal quando o dropdown abre/fecha (o Esc é do dropdown, não do modal). */
  onOpenChange: (open: boolean) => void;
}) {
  const [chain, setChain] = useState<CryptoChain | undefined>(undefined);
  const note = chain ? CHAIN_NOTE[chain] : undefined;

  return (
    <div className="flex flex-col gap-3 px-5 py-5">
      <p className="text-sm text-gray-11">
        Choose the network you will pay from. Only <strong className="text-gray-12">USDC</strong>{" "}
        is accepted — about ${amount}.
      </p>

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
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {note && <p className="-mt-1 text-xs text-gray-11">{note}</p>}

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
  evmChains,
  checkedAt,
  submitting,
  submitError,
  onSubmit,
}: {
  payment: CryptoPayment;
  /** Redes EVM ligadas — todas aceitam o mesmo pagamento (ver aviso). */
  evmChains: CryptoChain[];
  /** Hora da última consulta de status — o polling de 5s serve de relógio. */
  checkedAt: number;
  submitting: boolean;
  /** Erro do "enviei" (ex.: endereço inválido), já em texto para o usuário. */
  submitError: string | null;
  onSubmit: (payer: string) => void;
}) {
  const expired = new Date(payment.expiresAt).getTime() < checkedAt;
  const isSolana = payment.chain === "SOLANA";
  const [payer, setPayer] = useState(payment.declaredPayer ?? "");
  const network = CHAIN_LABEL[payment.chain];

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      {/* 1. Para onde e quanto — o essencial primeiro. */}
      <dl className="flex w-full flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <dt className="text-gray-11">Send to this wallet ({network})</dt>
          <dd className="flex items-center gap-2 rounded-md border border-gray-6 bg-gray-3 px-3 py-2">
            <span
              className="min-w-0 flex-1 break-all font-mono text-xs text-gray-12"
              data-testid="receiver"
            >
              {payment.receiver}
            </span>
            <button
              type="button"
              onClick={() => copy(payment.receiver, "Address")}
              className="shrink-0 text-xs font-semibold text-principal-11 hover:underline"
            >
              Copy
            </button>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-gray-11">Exact amount</dt>
          <dd className="flex items-center gap-2">
            <span className="font-mono font-semibold text-gray-12">
              {payment.amount} USDC
            </span>
            <button
              type="button"
              onClick={() => copy(payment.amount, "Amount")}
              className="text-xs font-semibold text-principal-11 hover:underline"
            >
              Copy
            </button>
          </dd>
        </div>
      </dl>

      {/* O valor exato (centavos únicos) + a carteira informada identificam o
          pagamento. Nas EVM o mesmo endereço recebe em todas as redes ligadas. */}
      <p className="w-full rounded-md border border-principal-7 bg-principal-3 px-3 py-2 text-xs leading-[1.4] text-principal-12">
        {isSolana
          ? `Send exactly ${payment.amount} USDC on Solana. The cents identify your payment — any other amount or token cannot be matched.`
          : `Send exactly ${payment.amount} USDC. The cents identify your payment — any other amount or token cannot be matched. Same address on ${evmChains
              .map((c) => CHAIN_LABEL[c])
              .join(", ")}: paying on any of them works.`}
      </p>

      {/* 2. Atalho opcional: QR / link direto para a carteira. */}
      <details className="group w-full rounded-md border border-gray-6 px-3 py-2 text-sm text-gray-11">
        <summary className="cursor-pointer select-none font-semibold text-gray-12">
          Pay with QR code
        </summary>
        <div className="mt-3 flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.qrDataUrl}
            alt={`Payment QR code for USDC on ${network}`}
            width={200}
            height={200}
            className="size-[200px] rounded-md bg-white"
          />
          <a href={payment.paymentUri} className={cn(SECONDARY_BTN, "w-full flex-none")}>
            Open in wallet
          </a>
        </div>
      </details>

      {/* 3. "Enviei": de qual carteira saiu o pagamento. */}
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (payer.trim()) onSubmit(payer.trim());
        }}
      >
        <TextField
          label="Your wallet (the one you are paying from)"
          placeholder={isSolana ? "Solana address" : "0x…"}
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          error={submitError ?? undefined}
          className="font-mono text-sm"
        />
        <button
          type="submit"
          disabled={!payer.trim() || submitting}
          className={cn(PRIMARY_BTN, "w-full flex-none disabled:cursor-not-allowed")}
        >
          {submitting ? "Checking…" : "I've sent the payment"}
        </button>
      </form>

      <p className="flex items-start gap-2 text-sm text-gray-11" aria-live="polite">
        <span
          className="mt-1.5 size-2 shrink-0 animate-pulse rounded-full bg-principal-9"
          aria-hidden="true"
        />
        {payment.declaredPayer && !submitting
          ? `We haven't found ${payment.amount} USDC from this wallet yet. Transfers take a few minutes to confirm — we keep checking automatically, you can close this window.`
          : expired
            ? "This window has expired. If you already paid, it will still be credited — otherwise start a new payment."
            : `Waiting for payment. Pay by ${new Date(payment.expiresAt).toLocaleTimeString(
                "en-US",
                { hour: "2-digit", minute: "2-digit" },
              )}.`}
      </p>
    </div>
  );
}

function Confirmed({ payment }: { payment: CryptoPayment }) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-8 text-center" aria-live="polite">
      <h3 className="text-xl font-semibold text-gray-12">Payment received</h3>
      <p className="text-sm leading-[1.4] text-gray-11">
        {payment.periodDays} days of Pro were added to your account
        {payment.confirmedAt ? ` on ${formatDate(payment.confirmedAt)}` : ""}.
      </p>
    </div>
  );
}
