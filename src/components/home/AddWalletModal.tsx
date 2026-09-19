"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import {
  catalogWallet,
  deleteWallet,
  type BackendChain,
  type Wallet,
} from "@/lib/api/wallets";
import { getApiErrorMessage } from "@/lib/api/client";
import { planErrorCode } from "@/lib/billing/planErrors";
import { ProLock } from "@/components/plans/ProLock";
import { useWalletSelection } from "@/lib/store/walletSelection";
import { extractWalletAddress } from "@/lib/extractWalletAddress";

/** Chains oferecidas na busca (valor = enum `Chain` do backend). */
const CHAINS: { value: BackendChain; label: string }[] = [
  { value: "SOLANA", label: "Solana" },
  { value: "ETHEREUM", label: "Ethereum" },
  { value: "BASE", label: "Base" },
  { value: "ARBITRUM", label: "Arbitrum" },
  { value: "BSC", label: "BNB Chain" },
  { value: "POLYGON", label: "Polygon" },
  { value: "OPTIMISM", label: "Optimism" },
];

interface AddWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Carteira sendo TROCADA (Figma "Editar carteira"). O formulário é o mesmo;
   * muda o título, o rótulo do botão e o fato de a antiga sair do catálogo.
   */
  replacing?: Wallet | null;
}

/**
 * Modal "Search wallet" / "Edit wallet" (Figma `546:17429` e `566:19613` — o
 * mesmo shell de 384px, só o título e o CTA mudam).
 *
 * Cataloga um endereço público na conta (SEM assinatura). Ao concluir, a
 * carteira vira a selecionada no dashboard e a ingestão dispara — se outra
 * pessoa já a acompanha, os dados são reusados na hora. Gate de montagem: só
 * renderiza o formulário quando aberto (assim o estado nasce limpo a cada
 * abertura, inclusive ao trocar qual carteira está sendo editada).
 */
export function AddWalletModal({
  open,
  onOpenChange,
  replacing = null,
}: AddWalletModalProps) {
  if (!open) return null;
  return (
    <WalletDialog
      key={replacing?.id ?? "new"}
      replacing={replacing}
      onClose={() => onOpenChange(false)}
    />
  );
}

function WalletDialog({
  replacing,
  onClose,
}: {
  replacing: Wallet | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const select = useWalletSelection((s) => s.select);
  const [chain, setChain] = useState<BackendChain>(replacing?.chain ?? "SOLANA");
  const [address, setAddress] = useState(replacing?.address ?? "");
  const [error, setError] = useState<string | null>(null);
  // Recusa por PLANO (teto de carteiras) ganha o convite ao Pro, não só o erro.
  const [planBlocked, setPlanBlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = replacing !== null;

  // Fecha no Escape (subscrição a evento externo — uso legítimo de effect).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Aceita URL colada (GMGN/Solscan/Birdeye/Axiom…) — extrai o endereço.
    const trimmed = extractWalletAddress(address);
    if (!trimmed) {
      setError("Enter the wallet address.");
      return;
    }
    if (trimmed !== address.trim()) setAddress(trimmed); // mostra o que foi usado
    setSubmitting(true);
    setError(null);
    setPlanBlocked(false);
    try {
      // Cataloga ANTES de remover a antiga: se o endereço novo for recusado,
      // o usuário não fica sem carteira nenhuma.
      const wallet = await catalogWallet({ chain, address: trimmed });
      if (replacing && replacing.id !== wallet.id) {
        await deleteWallet(replacing.id);
      }
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      select(wallet.id); // passa a mostrar a carteira recém-catalogada
      toast.success(
        isEdit ? "Wallet updated." : "Wallet added — reading its history.",
      );
      onClose();
    } catch (err) {
      setPlanBlocked(planErrorCode(err) !== null);
      setError(
        getApiErrorMessage(
          err,
          isEdit ? "Could not change the wallet." : "Could not add the wallet.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title = isEdit ? "Edit wallet" : "Search wallet";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(); // clique no backdrop fecha
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-[384px] rounded-lg border border-gray-6 bg-gray-2 p-6 shadow-xl">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-xl font-semibold text-gray-12">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-5 text-sm text-gray-11">
          Paste a public address to follow its history. You don’t have to be
          the owner — it’s just a search saved to your account.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex w-full flex-col gap-2">
            <label htmlFor="add-wallet-chain" className="text-base text-gray-12">
              Network
            </label>
            <select
              id="add-wallet-chain"
              value={chain}
              onChange={(e) => setChain(e.target.value as BackendChain)}
              className="h-12 rounded-lg border border-gray-6 bg-gray-2 px-3 text-base text-gray-12 outline-none transition-colors focus:border-secundaria-11"
            >
              {CHAINS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <TextField
            label="Public address"
            placeholder="0x… (EVM) or base58 (Solana)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            leftIcon={<Search className="size-4" />}
            error={error ?? undefined}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />

          {planBlocked && (
            <ProLock title="Track up to 20 wallets" detail="The Free plan tracks 1 wallet." />
          )}

          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting
              ? isEdit
                ? "Saving…"
                : "Adding…"
              : isEdit
                ? "Change wallet"
                : "Add wallet"}
          </Button>
        </form>
      </div>
    </div>
  );
}
