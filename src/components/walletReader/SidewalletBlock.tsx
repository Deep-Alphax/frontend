"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

import { cn } from "@/lib/cn";
import type { ScanResult, WalletRef } from "@/lib/walletReader/types";

/** Bloco de sidewallets/copytraders de um KOL (resultado cacheado + varredura). */
export function SidewalletBlock({
  wallets,
  scans,
  dismissed,
  onDismiss,
  onRun,
  onOpenKol,
}: {
  /** Carteiras do KOL — o usuário escolhe QUAL varrer. */
  wallets: WalletRef[];
  /** Varreduras já feitas, uma por carteira. */
  scans: ScanResult[];
  dismissed: string[];
  onDismiss: (address: string) => void;
  onRun: (address: string) => Promise<void>;
  onOpenKol: (id: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A varredura é de UMA carteira: analisa os últimos tokens DELA. Quem escolhe
  // é o usuário porque a primeira do cadastro costuma não ser a mais ativa —
  // varrer uma carteira parada devolve "nada encontrado" sem que isso signifique
  // que o KOL não tem sidewallet.
  const [target, setTarget] = useState(() => wallets[0]?.address ?? "");
  const scan = scans.find((s) => s.publicWallet === target);

  const dset = new Set(dismissed);
  const visible = (scan?.flagged ?? []).filter((f) => !dset.has(f.address));

  // A varredura roda em FILA no backend: o pedido volta na hora como `queued` e
  // o resultado chega por socket. O estado de "em andamento" tem que vir do
  // scan, não só do clique local — senão o botão reabilita antes da hora e um
  // reload perde o rastro de que já tem varredura pendente.
  const pending = running || scan?.status === "queued" || scan?.status === "running";

  const run = async () => {
    if (!target) return;
    setRunning(true);
    setError(null);
    try {
      await onRun(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na varredura.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      {/* Escolha da carteira + disparo. */}
      <div className="mb-2 flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-gray-11">Carteira a varrer</span>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger size="sm" aria-label="Carteira a varrer">
              <SelectValue placeholder="Escolha uma carteira" />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((w) => (
                <SelectItem key={w.address} value={w.address}>
                  {w.name} · {w.address.slice(0, 6)}…{w.address.slice(-4)}
                  {scans.some((s) => s.publicWallet === w.address) ? " ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <button
          type="button"
          onClick={run}
          disabled={pending || !target}
          className="shrink-0 rounded-lg border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4 disabled:opacity-60"
        >
          {pending
            ? scan?.status === "queued"
              ? "Na fila…"
              : "Escaneando…"
            : scan
              ? "Rodar nova varredura"
              : "Rodar varredura"}
        </button>
      </div>

      <p className="mb-2 text-xs text-gray-11">
        {scan && scan.status === "complete"
          ? "Última varredura desta carteira: " +
            new Date(scan.scannedAt).toLocaleString("pt-BR")
          : pending
            ? "Varredura em andamento — o resultado aparece aqui sozinho."
            : "Esta carteira ainda não foi varrida."}
      </p>

      <p className="mb-3 text-xs leading-relaxed text-gray-11">
        Cruza dados on-chain dos últimos 5 tokens da carteira escolhida contra quem transacionou com
        ela. Descobre endereços que ainda não estão no índice e só confirma com evidência forte
        (link direto ou padrão repetido).
      </p>

      {error && (
        <div className="mb-3 rounded-lg border border-vermelho-7 bg-vermelho-2 p-3 text-xs text-vermelho-11">
          {error}
        </div>
      )}

      {scan?.status === "error" && (
        <div className="rounded-lg border border-vermelho-7 bg-vermelho-2 p-3 text-xs text-vermelho-11">
          {scan.summary}
        </div>
      )}

      {scan && scan.status === "complete" && (
        <>
          <div className="rounded-lg border border-gray-6 bg-gray-1 p-3 text-xs leading-relaxed text-gray-11">
            {scan.summary}
          </div>
          {visible.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {visible.map((f) => (
                <div key={f.address} className="rounded-lg border border-gray-6 bg-gray-1 p-2.5">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs font-medium",
                        f.role === "sidewallet"
                          ? "border-vermelho-7 bg-vermelho-3 text-vermelho-11"
                          : "border-secundaria-7 bg-secundaria-3 text-secundaria-11",
                      )}
                    >
                      {f.role === "sidewallet" ? "Sidewallet" : "Copytrader"}
                    </span>
                    {f.role === "sidewallet" && (
                      <span className="rounded-full border border-gray-6 px-2 py-0.5 text-xs text-gray-11">
                        {f.confidence === "high" ? "Link direto" : "Padrão repetido"}
                      </span>
                    )}
                    {f.recognizedElsewhere && (
                      <span className="rounded-full border border-principal-8 bg-principal-3 px-2 py-0.5 text-xs text-principal-11">
                        ⚠ trader conhecido{f.recognizedAs ? `: ${f.recognizedAs}` : ""}
                      </span>
                    )}
                    <span className="text-sm text-gray-12">
                      {f.name ?? "carteira desconhecida"}
                      {f.ownerKolName && f.ownerKolName !== f.name ? ` (${f.ownerKolName})` : ""}
                    </span>
                    <div className="flex-1" />
                    {f.ownerKolId && (
                      <button
                        type="button"
                        onClick={() => onOpenKol(f.ownerKolId as string)}
                        className="shrink-0 text-xs text-secundaria-11 underline underline-offset-2 hover:text-secundaria-12"
                      >
                        abrir perfil →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDismiss(f.address)}
                      className="shrink-0 text-xs text-gray-11 underline underline-offset-2 hover:text-gray-12"
                    >
                      remover
                    </button>
                  </div>
                  <div className="truncate font-mono text-xs text-gray-11">{f.address}</div>
                  <div className="mt-1 text-xs leading-relaxed text-gray-11">{f.reason}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
