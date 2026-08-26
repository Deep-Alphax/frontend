"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import type { ScanResult } from "@/lib/walletReader/types";

/** Bloco de sidewallets/copytraders de um KOL (resultado cacheado + varredura). */
export function SidewalletBlock({
  scan,
  dismissed,
  onDismiss,
  onRun,
  onOpenKol,
}: {
  scan: ScanResult | undefined;
  dismissed: string[];
  onDismiss: (address: string) => void;
  onRun: () => Promise<void>;
  onOpenKol: (id: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dset = new Set(dismissed);
  const visible = (scan?.flagged ?? []).filter((f) => !dset.has(f.address));

  const run = async () => {
    setRunning(true);
    setError(null);
    try {
      await onRun();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha na varredura.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-11">
          {scan ? "Última varredura: " + new Date(scan.scannedAt).toLocaleString("pt-BR") : "Ainda não escaneado."}
        </span>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="shrink-0 rounded-lg border border-gray-6 bg-gray-3 px-3 py-1.5 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4 disabled:opacity-60"
        >
          {running ? "Escaneando…" : scan ? "Rodar nova varredura" : "Rodar varredura"}
        </button>
      </div>

      <p className="mb-3 text-xs leading-relaxed text-gray-11">
        Cruza dados on-chain (GMGN) dos últimos 5 tokens da carteira pública contra as outras carteiras do
        índice. Só confirma com evidência forte (link direto ou padrão repetido).
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
