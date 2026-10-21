"use client";

import { useState } from "react";

import { Modal } from "@/components/walletReader/Modal";
import { ProLock } from "@/components/plans/ProLock";
import { usePlan } from "@/lib/billing/usePlan";
import { NetworkSelect } from "@/components/walletReader/WalletNetwork";
import { autoChain, walletFormError, type WalletChain } from "@/lib/walletReader/chains";
import type { WalletRef } from "@/lib/walletReader/types";

/** Modal de criação de um novo KOL manual. */
export function AddKolModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, wallet?: WalletRef) => void;
}) {
  const { isPro } = usePlan();
  const [name, setName] = useState("");
  const [wName, setWName] = useState("");
  const [wAddr, setWAddr] = useState("");
  const [wChain, setWChain] = useState<WalletChain | null>(null);

  // Carteira é opcional; se vier, a rede é obrigatória e coerente com o endereço.
  const walletError = walletFormError(wAddr, wChain);
  const canCreate = !!name.trim() && !walletError;

  const reset = () => {
    setName("");
    setWName("");
    setWAddr("");
    setWChain(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add KOL"
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-gray-6 bg-gray-3 px-4 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => {
              const n = name.trim();
              if (!canCreate) return;
              const addr = wAddr.trim();
              onCreate(
                n,
                addr && wChain ? { name: wName.trim() || "Main", address: addr, chain: wChain } : undefined,
              );
              reset();
            }}
            className="h-9 rounded-lg bg-principal-9 px-4 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create KOL
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-11">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Cupsey"
            className="h-9 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
        </label>
        {/* FREE: o servidor ignora carteira de KOL — não oferecer um campo que
            seria descartado em silêncio. */}
        {isPro ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-11">Wallet nickname (optional)</span>
              <input
                value={wName}
                onChange={(e) => setWName(e.target.value)}
                placeholder="Main"
                className="h-9 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-gray-11">Wallet address (optional)</span>
              <input
                value={wAddr}
                onChange={(e) => {
                  setWAddr(e.target.value);
                  setWChain((c) => autoChain(e.target.value, c));
                }}
                placeholder="paste the on-chain address"
                className="h-9 rounded-lg border border-gray-6 bg-gray-1 px-3 font-mono text-xs text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
              />
            </label>
            {wAddr.trim() && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-gray-11">Network</span>
                <NetworkSelect size="sm" value={wChain} address={wAddr} onChange={setWChain} className="w-full" />
              </div>
            )}
            {walletError && (
              <p role="alert" className="text-xs text-vermelho-11">
                {walletError}
              </p>
            )}
          </>
        ) : (
          <ProLock
            title="Link wallets to your KOLs"
            detail="KOL wallets are part of the Pro plan."
          />
        )}
      </div>
    </Modal>
  );
}
