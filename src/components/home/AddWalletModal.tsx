"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { catalogWallet, type BackendChain } from "@/lib/api/wallets";
import { getApiErrorMessage } from "@/lib/api/client";
import { useWalletSelection } from "@/lib/store/walletSelection";

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
}

/**
 * Modal "Buscar carteira": cataloga um endereço público na conta (SEM assinatura).
 * Ao concluir, a carteira vira a selecionada no dashboard e a ingestão dispara — se
 * outra pessoa já a acompanha, os dados são reusados na hora. Gate de montagem: só
 * renderiza o formulário quando aberto (assim o estado nasce limpo a cada abertura).
 */
export function AddWalletModal({ open, onOpenChange }: AddWalletModalProps) {
  if (!open) return null;
  return <AddWalletDialog onClose={() => onOpenChange(false)} />;
}

function AddWalletDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const select = useWalletSelection((s) => s.select);
  const [chain, setChain] = useState<BackendChain>("SOLANA");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const trimmed = address.trim();
    if (!trimmed) {
      setError("Informe o endereço da carteira.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const wallet = await catalogWallet({ chain, address: trimmed });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      select(wallet.id); // passa a mostrar a carteira recém-catalogada
      toast.success("Carteira adicionada — lendo o histórico.");
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível adicionar a carteira."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(); // clique no backdrop fecha
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Buscar carteira"
    >
      <div className="w-full max-w-md rounded-lg border border-gray-6 bg-gray-2 p-6 shadow-xl">
        <div className="mb-1 flex items-start justify-between">
          <h2 className="text-xl font-semibold text-gray-12">Buscar carteira</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mb-5 text-sm text-gray-11">
          Cole um endereço público para acompanhar o histórico dele. Não é preciso ser
          o dono — é só uma busca salva na sua conta.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex w-full flex-col gap-2">
            <label htmlFor="add-wallet-chain" className="text-base text-gray-12">
              Rede
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
            label="Endereço"
            placeholder="0x… (EVM) ou base58 (Solana)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            leftIcon={<Search className="size-4" />}
            error={error ?? undefined}
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />

          <Button type="submit" disabled={submitting} className="mt-1">
            {submitting ? "Adicionando…" : "Adicionar carteira"}
          </Button>
        </form>
      </div>
    </div>
  );
}
