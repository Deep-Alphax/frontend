"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { redeemInvite } from "@/lib/api/access";
import { PLAN_KEY } from "@/lib/api/billing";
import { useSession } from "@/lib/auth/useSession";
import {
  clearInvite,
  inviteErrorMessage,
  isDeadInviteError,
  storedInvite,
  subscribeInvite,
} from "@/lib/invite";

/*
 * Resgate do convite Elixir Alpha guardado pelo link (`lib/invite.ts`).
 *
 * Montado uma vez (em `Providers`) e só age LOGADO: aceitar troca o cargo da
 * conta, então nunca resgata sozinho — pergunta antes, e "Not now" descarta o
 * código (senão a pergunta voltaria em toda página).
 *
 * Quem já é Elixir Alpha não tem o que aceitar: o código é limpo em silêncio
 * (o backend nem contaria o uso).
 */

const noopSubscribe = () => () => {};

export function InviteRedeemer() {
  const { isAuthenticated, profile } = useSession();
  // `undefined` no servidor e na hidratação: o diálogo só aparece no cliente.
  const code = useSyncExternalStore(
    isAuthenticated ? subscribeInvite : noopSubscribe,
    () => (isAuthenticated ? storedInvite() : undefined),
    () => undefined,
  );
  const router = useRouter();
  const qc = useQueryClient();

  const alreadyMember = profile?.role === "ELIXIR_ALPHA";

  useEffect(() => {
    if (code && alreadyMember) clearInvite();
  }, [code, alreadyMember]);

  const redeem = useMutation({
    mutationFn: redeemInvite,
    onSuccess: (result) => {
      clearInvite();
      // Cargo novo = acesso novo (Mentoria liberada) e perfil com outro `role`.
      void qc.invalidateQueries({ queryKey: PLAN_KEY });
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(
        result.changed
          ? "Welcome to Elixir Alpha! Mentorship is now unlocked."
          : "You already have Elixir Alpha access.",
      );
      router.push("/mentorship");
    },
    onError: (error) => {
      // Código morto (inexistente, vencido, esgotado, conta inelegível) sai do
      // storage; 429/rede mantêm para tentar de novo depois.
      if (isDeadInviteError(error)) clearInvite();
      toast.error(inviteErrorMessage(error, "Could not accept the invite. Please try again."));
    },
  });

  const dismiss = useCallback(() => {
    if (redeem.isPending) return;
    clearInvite();
  }, [redeem.isPending]);

  const open = isAuthenticated && !!code && !alreadyMember;

  return (
    <InviteDialog
      open={open}
      pending={redeem.isPending}
      onAccept={() => code && redeem.mutate(code)}
      onDismiss={dismiss}
    />
  );
}

/** Diálogo no padrão dos modais do app (portal, scrim, Esc, trava de scroll). */
function InviteDialog({
  open,
  pending,
  onAccept,
  onDismiss,
}: {
  open: boolean;
  pending: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onDismiss]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onDismiss}
        className="absolute inset-0 cursor-default bg-gray-1/80"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-dialog-title"
        aria-describedby="invite-dialog-desc"
        className="relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl"
      >
        <div className="flex flex-col gap-3 border-b border-gray-6 px-5 py-6">
          <h2 id="invite-dialog-title" className="text-xl font-semibold text-gray-12">
            You&apos;ve been invited to Elixir Alpha
          </h2>
          <p id="invite-dialog-desc" className="text-base text-gray-11">
            Accepting gives your account access to the Mentorship. You can still
            upgrade to Pro at any time to unlock every feature.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 p-4">
          <Button
            variant="secondary"
            className="h-10 min-w-0 flex-1 py-0"
            disabled={pending}
            onClick={onDismiss}
          >
            Not now
          </Button>
          <Button
            className="h-10 min-w-0 flex-1"
            disabled={pending}
            onClick={onAccept}
            autoFocus
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {pending ? "Accepting…" : "Accept"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
