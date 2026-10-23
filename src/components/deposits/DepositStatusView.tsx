"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import toast from "react-hot-toast";

import type { DepositView } from "@/lib/api/deposits";
import { cn } from "@/lib/cn";
import {
  CHAIN_LABEL,
  formatCountdown,
  formatTokenAmount,
  shortAddress,
  timelineSteps,
  type StepState,
} from "@/lib/deposits/format";
import { formatBrl } from "@/lib/pix/format";
import { PRIMARY_BTN } from "@/components/plans/crypto/walletUi";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { AssetLabel } from "@/components/deposits/depositUi";

/*
 * Etapas 2 e 3 do depósito: pagar o Pix (QR + copia e cola + prazo) e
 * acompanhar a entrega (linha do tempo). O status vem do servidor; aqui só se
 * desenha o que ele disse.
 */

/** Relógio de 1 s para o prazo do QR (só enquanto a etapa de pagar está aberta). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Para onde vai: "SOL on Solana · to 7xKX…AJ9M". */
function Destination({ deposit }: { deposit: DepositView }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
      <AssetLabel chain={deposit.chain} symbol={deposit.symbol} />
      <span className="text-gray-11">
        to <span className="font-mono text-gray-12" title={deposit.toAddress}>{shortAddress(deposit.toAddress)}</span>
      </span>
    </div>
  );
}

export function PayStep({ deposit, onExpired }: { deposit: DepositView; onExpired: () => void }) {
  const now = useNow();
  const expiresAt = deposit.expiresAt ? new Date(deposit.expiresAt).getTime() : null;
  const left = expiresAt === null ? null : expiresAt - now;
  const expired = left !== null && left <= 0;

  // Prazo acabou no relógio local: mostra "venceu" já (o servidor confirma depois).
  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

  const code = deposit.qrCopyPaste;
  const copy = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Pix code copied");
    } catch {
      toast.error("Couldn't copy. Select the code and copy it manually.");
    }
  }, [code]);

  // QR é gerado em segundo plano: até sair, skeleton no formato dele.
  if (!code || !deposit.qrImage) {
    return (
      <SkeletonGroup className="flex flex-col items-center gap-4 px-5 py-6" label="Generating QR code">
        <Skeleton className="size-52 rounded-lg" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </SkeletonGroup>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-6">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada no servidor */}
      <img
        src={deposit.qrImage}
        alt="Pix QR code"
        width={208}
        height={208}
        className="size-52 rounded-lg bg-white p-2"
      />

      <div className="flex flex-col items-center gap-1.5">
        <p className="text-2xl font-semibold leading-none text-gray-12">{formatBrl(deposit.amountBrlCents)}</p>
        <Destination deposit={deposit} />
      </div>

      <div className="flex w-full flex-col gap-2">
        <label htmlFor="deposit-pix-code" className="text-sm text-gray-12">
          Pix copy and paste
        </label>
        <div className="flex gap-2">
          <input
            id="deposit-pix-code"
            readOnly
            value={code}
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-3 px-3 font-mono text-sm text-gray-12 outline-none"
          />
          <button type="button" onClick={copy} className={cn(PRIMARY_BTN, "flex-none")}>
            Copy
          </button>
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-6 bg-gray-3/60 px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-gray-11" aria-live="polite">
          <span
            className="size-4 animate-spin rounded-full border-2 border-gray-6 border-t-principal-9 motion-reduce:animate-none"
            aria-hidden="true"
          />
          Waiting for payment…
        </span>
        {left !== null && (
          <span className="tabular-nums text-gray-11">
            Expires in <span className="text-gray-12">{formatCountdown(left)}</span>
          </span>
        )}
      </div>

      <p className="text-center text-xs leading-[1.4] text-gray-11">
        Use only this code — it works once. You can close this window after paying; delivery to your
        wallet is automatic.
      </p>
    </div>
  );
}

export function ExpiredStep({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-8 text-center" aria-live="polite">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-semibold text-gray-12">This QR code expired</h3>
        <p className="text-sm text-gray-11">
          Generate a new Pix to try again. If you already paid, contact support — we&apos;ll sort it out.
        </p>
      </div>
      <button type="button" onClick={onRestart} className={cn(PRIMARY_BTN, "w-full flex-none")}>
        Start again
      </button>
    </div>
  );
}

const TITLE: Partial<Record<DepositView["status"], string>> = {
  PAID: "Pix received",
  SENDING: "Sending your crypto",
  SENT: "Sending your crypto",
  DELIVERED: "Delivered",
  FAILED: "Deposit failed",
};

export function ProgressStep({ deposit }: { deposit: DepositView }) {
  const steps = timelineSteps(deposit);
  const delivered = deposit.status === "DELIVERED";
  const failed = deposit.status === "FAILED";

  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div className="flex flex-col items-center gap-1.5 text-center" aria-live="polite">
        <h3 className="text-xl font-semibold text-gray-12">{TITLE[deposit.status] ?? "Deposit"}</h3>
        {delivered && deposit.deliveredAmount ? (
          <p className="text-2xl font-semibold leading-none text-green-11">
            {formatTokenAmount(deposit.deliveredAmount, deposit.symbol)}
          </p>
        ) : null}
        <Destination deposit={deposit} />
      </div>

      <ol aria-label="Deposit progress" className="flex flex-col rounded-lg border border-gray-6 bg-gray-3/60 p-4">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3" aria-current={s.state === "current" ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <StepMarker state={s.state} />
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cn("w-px flex-1 my-1 min-h-4", s.state === "done" ? "bg-green-9/60" : "bg-gray-6")}
                />
              )}
            </div>
            <div className={cn("flex min-w-0 flex-col gap-1", i < steps.length - 1 && "pb-4")}>
              <span
                className={cn(
                  "text-sm leading-6",
                  s.state === "upcoming" ? "text-gray-11" : s.state === "failed" ? "text-danger-11" : "text-gray-12",
                  s.state === "current" && "font-medium",
                )}
              >
                {s.label}
                <span className="sr-only"> — {STATE_SR[s.state]}</span>
              </span>
              {s.link && (
                <a
                  href={s.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-secundaria-11 hover:underline"
                >
                  {s.link.label}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      {failed ? (
        <div role="alert" className="flex flex-col gap-1 rounded-lg border border-danger-10/50 bg-danger-10/10 p-3 text-sm">
          <p className="text-gray-12">{deposit.error ?? "We couldn't deliver this deposit."}</p>
          <p className="text-gray-11">
            Contact support with reference <span className="font-mono text-gray-12">{deposit.id}</span> — your
            Pix was received and we&apos;ll sort it out.
          </p>
        </div>
      ) : !delivered ? (
        <p className="text-center text-xs leading-[1.4] text-gray-11">
          You can close this window — delivery continues automatically.
          {deposit.chain !== "SOLANA" ? ` Bridging to ${CHAIN_LABEL[deposit.chain]} takes a few minutes.` : ""}
        </p>
      ) : null}
    </div>
  );
}

const STATE_SR: Record<StepState, string> = {
  done: "done",
  current: "in progress",
  upcoming: "pending",
  failed: "failed",
};

function StepMarker({ state }: { state: StepState }) {
  const box = "flex size-6 shrink-0 items-center justify-center rounded-full";
  if (state === "done") {
    return (
      <span className={cn(box, "bg-green-9 text-gray-1")} aria-hidden>
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className={cn(box, "bg-danger-10 text-white")} aria-hidden>
        <X className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className={cn(box, "animate-spin border-2 border-principal-9/25 border-t-principal-9 motion-reduce:animate-none")}
        aria-hidden
      />
    );
  }
  return <span className={cn(box, "border-2 border-gray-6 bg-gray-2")} aria-hidden />;
}

/** Skeleton no formato da etapa de acompanhamento (depósito reaberto carregando). */
export function StatusSkeleton() {
  return (
    <SkeletonGroup label="Loading deposit" className="flex flex-col gap-5 px-5 py-6">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 w-36" />
        </div>
      ))}
    </SkeletonGroup>
  );
}
