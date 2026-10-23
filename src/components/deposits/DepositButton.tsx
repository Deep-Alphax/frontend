"use client";

import { lazy, Suspense, useState } from "react";

import { DepositIcon } from "@/components/icons/hugeicons";
import { useDepositModal } from "@/lib/store/depositModal";

/*
 * Botão "Deposit" do header (só logado — o Topbar decide). Estilo secundário,
 * igual ao chip de carteira, para não competir com os CTAs amarelos. No
 * celular fica só o ícone.
 *
 * Também é quem MONTA o modal: o `WalletChip` abre o mesmo modal pelo store
 * (`useDepositModal`). O chunk do modal só carrega no primeiro uso (e é
 * pré-carregado no hover), então o header de toda página não paga por ele.
 */

const loadModal = () => import("@/components/deposits/DepositModal");
const DepositModal = lazy(loadModal);

export function DepositButton() {
  const open = useDepositModal((s) => s.open);
  const show = useDepositModal((s) => s.show);
  // Depois da 1ª abertura fica montado (o AnimatePresence anima a saída).
  const [loaded, setLoaded] = useState(false);
  if (open && !loaded) setLoaded(true);

  return (
    <>
      <button
        type="button"
        onClick={() => show()}
        onPointerEnter={() => void loadModal()}
        onFocus={() => void loadModal()}
        aria-label="Deposit"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-6 bg-gray-3 px-2.5 text-sm font-semibold text-gray-12 transition-colors hover:border-gray-8 hover:bg-gray-4 sm:px-3"
      >
        <DepositIcon className="size-5 shrink-0" />
        <span className="hidden sm:inline">Deposit</span>
      </button>
      {loaded && (
        <Suspense fallback={null}>
          <DepositModal />
        </Suspense>
      )}
    </>
  );
}
