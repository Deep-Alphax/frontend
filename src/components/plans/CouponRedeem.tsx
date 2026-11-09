"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { BILLING_DETAILS_KEY, PLAN_KEY } from "@/lib/api/billing";
import { redeemCoupon } from "@/lib/api/coupons";
import { useSession } from "@/lib/auth/useSession";
import { usePlan } from "@/lib/billing/usePlan";
import {
  clearCoupon,
  couponErrorMessage,
  isDeadCouponError,
  storedCoupon,
  subscribeCoupon,
} from "@/lib/coupon";

/**
 * "Have a coupon?" do card PRO — resgate do PRO grátis.
 *
 * Só aparece para quem está logado e é FREE (com o plano já carregado: o
 * padrão "FREE enquanto carrega" do `usePlan` faria o campo piscar para quem é
 * PRO). Se a conta é elegível quem decide é o servidor (409), não esta tela.
 *
 * O código do link compartilhável (`?coupon=`) chega já guardado por
 * `lib/coupon.ts`; aqui ele só PREENCHE o campo — o resgate continua sendo um
 * clique do usuário, nunca automático.
 */
export function CouponRedeem() {
  const { isAuthenticated } = useSession();
  const { plan, isLoading } = usePlan();
  if (!isAuthenticated || isLoading || plan !== "FREE") return null;
  return <CouponRedeemForm />;
}

/** No servidor não há storage: o HTML sai sem cupom e a hidratação completa. */
const noCoupon = () => undefined;

function CouponRedeemForm() {
  const qc = useQueryClient();
  const stored = useSyncExternalStore(subscribeCoupon, storedCoupon, noCoupon);
  const [open, setOpen] = useState(false);
  // null = espelha o código guardado; vira estado próprio quando o usuário digita.
  const [draft, setDraft] = useState<string | null>(null);

  const redeem = useMutation({
    mutationFn: redeemCoupon,
    onSuccess: (result) => {
      clearCoupon();
      setDraft("");
      setOpen(false);
      toast.success(`Pro unlocked until ${formatDate(result.currentPeriodEnd)}.`);
      void qc.invalidateQueries({ queryKey: PLAN_KEY });
      void qc.invalidateQueries({ queryKey: BILLING_DETAILS_KEY });
    },
    onError: (error) => {
      // Código morto não pode ficar preenchido para sempre; erro transitório
      // (429, rede) mantém o código para tentar de novo.
      if (isDeadCouponError(error)) clearCoupon();
    },
  });

  const value = draft ?? stored ?? "";
  const expanded = open || Boolean(stored);
  const code = value.trim();

  if (!expanded) {
    return (
      <p className="w-full text-center text-sm text-gray-11">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-semibold text-principal-11 hover:underline"
        >
          Have a coupon?
        </button>
      </p>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!code || redeem.isPending) return;
        // Congela o que foi enviado: se o servidor descartar o código guardado,
        // o campo (e o erro embaixo dele) continuam na tela.
        setOpen(true);
        setDraft(code);
        redeem.mutate(code);
      }}
    >
      <TextField
        label="Coupon code"
        placeholder="e.g. LAUNCH30"
        value={value}
        onChange={(e) => {
          setDraft(e.target.value.toUpperCase());
          if (redeem.isError) redeem.reset();
        }}
        maxLength={32}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={
          redeem.isError
            ? couponErrorMessage(redeem.error, "Could not redeem this coupon.")
            : undefined
        }
      />
      <Button
        type="submit"
        variant="secondary"
        className="h-11 p-0"
        disabled={!code || redeem.isPending}
      >
        {redeem.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Redeeming…
          </>
        ) : (
          "Redeem"
        )}
      </Button>
    </form>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
