"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  getSources,
  createSource,
  deleteSource,
  addSourceWallet,
  removeSourceWallet,
  type Source,
} from "@/lib/api/sources";
import { getApiErrorMessage } from "@/lib/api/client";
import type { BackendChain } from "@/lib/api/wallets";
import { cn } from "@/lib/cn";

const CHAINS: BackendChain[] = [
  "SOLANA",
  "ETHEREUM",
  "BASE",
  "ARBITRUM",
  "BSC",
  "POLYGON",
  "OPTIMISM",
];

const shortAddress = (a: string) => (a.length <= 12 ? a : `${a.slice(0, 6)}…${a.slice(-4)}`);

const inputClass =
  "rounded-md border border-gray-6 bg-gray-1 px-3 py-2 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus:border-gray-11";
const primaryBtn =
  "flex items-center gap-1.5 rounded-md bg-principal-9 px-3 py-2 text-sm font-medium text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-40";

/** Card de uma fonte: nome, carteiras (com remoção), adicionar carteira, remover fonte. */
function SourceCard({ source }: { source: Source }) {
  const queryClient = useQueryClient();
  const [chain, setChain] = useState<BackendChain>("SOLANA");
  const [address, setAddress] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sources"] });
    queryClient.invalidateQueries({ queryKey: ["sources-analytics"] });
  };

  const addWallet = useMutation({
    mutationFn: () => addSourceWallet(source.id, { chain, address: address.trim() }),
    onSuccess: () => {
      setAddress("");
      invalidate();
      toast.success("Carteira da fonte adicionada.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Não foi possível adicionar a carteira.")),
  });

  const removeWallet = useMutation({
    mutationFn: (walletId: string) => removeSourceWallet(source.id, walletId),
    onSuccess: invalidate,
    onError: (e) => toast.error(getApiErrorMessage(e, "Não foi possível remover a carteira.")),
  });

  const removeSource = useMutation({
    mutationFn: () => deleteSource(source.id),
    onSuccess: () => {
      invalidate();
      toast.success("Fonte removida.");
    },
    onError: (e) => toast.error(getApiErrorMessage(e, "Não foi possível remover a fonte.")),
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-6 bg-gray-1 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-12">{source.name}</span>
        <button
          type="button"
          aria-label={`Remover fonte ${source.name}`}
          onClick={() => {
            if (window.confirm(`Remover a fonte "${source.name}"?`)) removeSource.mutate();
          }}
          className="flex size-8 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-danger-11"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {source.wallets.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {source.wallets.map((w) => (
            <li
              key={w.id}
              className="flex items-center gap-2 rounded-md border border-gray-6 px-2.5 py-1.5 text-xs"
            >
              <span className="text-gray-11">{w.chain}</span>
              <span className="font-mono text-gray-12">{shortAddress(w.address)}</span>
              {w.syncStatus === "PENDING" || w.syncStatus === "SYNCING" ? (
                <Loader2 className="size-3 animate-spin text-gray-11" aria-label="sincronizando" />
              ) : null}
              <button
                type="button"
                aria-label="Remover carteira"
                onClick={() => removeWallet.mutate(w.id)}
                className="text-gray-11 transition-colors hover:text-danger-11"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-gray-11">Nenhuma carteira — adicione o endereço on-chain da fonte.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value as BackendChain)}
          className={cn(inputClass, "w-32")}
        >
          {CHAINS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Endereço da carteira da fonte"
          className={cn(inputClass, "min-w-0 flex-1")}
        />
        <button
          type="button"
          disabled={address.trim().length === 0 || addWallet.isPending}
          onClick={() => addWallet.mutate()}
          className={primaryBtn}
        >
          {addWallet.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Carteira
        </button>
      </div>
    </div>
  );
}

/**
 * Gestão de FONTES de alpha: criar fonte (nome + 1ª carteira), listar/editar
 * (adicionar/remover carteiras, remover fonte). As carteiras da fonte são
 * endereços PÚBLICOS que o usuário segue (sem assinatura — não são dele). Após
 * cadastrar, o backend sincroniza e atribui os trades por lead-lag → a tabela
 * "De onde vieram os trades" (abaixo) popula.
 */
export function SourcesManager() {
  const queryClient = useQueryClient();
  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: getSources,
    retry: false,
  });

  const [name, setName] = useState("");
  const [chain, setChain] = useState<BackendChain>("SOLANA");
  const [address, setAddress] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const src = await createSource({ name: name.trim() });
      if (address.trim()) await addSourceWallet(src.id, { chain, address: address.trim() });
      return src;
    },
    onSuccess: () => {
      setName("");
      setAddress("");
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      queryClient.invalidateQueries({ queryKey: ["sources-analytics"] });
      toast.success("Fonte adicionada.");
    },
    onError: (e) => {
      // A fonte pode ter sido criada mas a carteira falhado → atualiza mesmo assim.
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      toast.error(getApiErrorMessage(e, "Não foi possível criar a fonte."));
    },
  });

  const canCreate =
    name.trim().length > 0 && address.trim().length > 0 && !create.isPending;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-2 p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-gray-12">Fontes de alpha</h3>
        <p className="text-sm text-gray-11">
          Cadastre as carteiras dos desks/grupos que você segue. Seus trades são
          atribuídos a elas quando você compra o mesmo token logo depois.
        </p>
      </div>

      {/* Nova fonte */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da fonte (ex.: Obsidian Desk)"
          className={cn(inputClass, "w-56")}
        />
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value as BackendChain)}
          className={cn(inputClass, "w-32")}
        >
          {CHAINS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Endereço da carteira da fonte"
          className={cn(inputClass, "min-w-0 flex-1")}
        />
        <button
          type="button"
          disabled={!canCreate}
          onClick={() => create.mutate()}
          className={primaryBtn}
        >
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Adicionar fonte
        </button>
      </div>

      {/* Lista de fontes */}
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-gray-1" aria-hidden />
      ) : sources.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sources.map((s) => (
            <SourceCard key={s.id} source={s} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
