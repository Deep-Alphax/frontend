"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getScan, getScans, requestScan } from "@/lib/api/walletReader";
import { getSocket } from "@/lib/realtime/socket";
import type { ScanResult, ScanSummary } from "@/lib/walletReader/types";

const SCANS_URL = "/wallet-reader/sidewallet-scans.json";

/** Chave da query — o realtime chega por ela. */
export const SCANS_KEY = ["wallet-reader-scans"] as const;
/** Chave do resultado COMPLETO de um scan (com evidências). */
export const scanKey = (kolId: string) => ["wallet-reader-scan", kolId] as const;

type ScanMap = Record<string, ScanSummary>;

/** Descarta as evidências — a listagem só guarda o resumo. */
function toSummary(r: ScanResult): ScanSummary {
  return {
    kolId: r.kolId,
    kolName: r.kolName,
    scannedAt: r.scannedAt,
    status: r.status,
    publicWallet: r.publicWallet,
    tokensAnalyzed: r.tokensAnalyzed,
    apiCalls: r.apiCalls,
    summary: r.summary,
  };
}

/** Backend primeiro; JSON estático só quando ele está fora (dev offline). */
async function fetchScans(): Promise<ScanMap> {
  try {
    return await getScans();
  } catch {
    try {
      const r = await fetch(SCANS_URL);
      const data = r.ok ? await r.json() : { scans: {} };
      return (data.scans ?? {}) as ScanMap;
    } catch {
      return {};
    }
  }
}

/**
 * Varreduras de sidewallets/copytraders.
 *
 * O scan é do PRESET — igual para todo usuário —, então o backend serve o que já
 * está no banco e só revarre quando envelhece. Pedir uma varredura não bloqueia:
 * o POST devolve `queued` na hora e o resultado chega por `scan:update`. Nada de
 * polling (é a regra do projeto para estado que muda no servidor).
 */
export function useScans() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: SCANS_KEY, queryFn: fetchScans });

  const merge = useCallback(
    (r: ScanSummary) =>
      qc.setQueryData<ScanMap>(SCANS_KEY, (prev) => ({ ...(prev ?? {}), [r.kolId]: r })),
    [qc],
  );

  useEffect(() => {
    const socket = getSocket();
    const handler = (r: ScanResult) => {
      if (!r?.kolId) return;
      // A lista guarda só o RESUMO; as evidências ficam com `useScan(kolId)`.
      merge(toSummary(r));
      qc.setQueryData(scanKey(r.kolId), r);
    };
    socket.on("scan:update", handler);
    socket.connect();
    // Só remove o LISTENER: o socket é singleton da aba e o Radar também o usa —
    // desconectar aqui derrubaria o feed dele ao fechar o modal.
    return () => {
      socket.off("scan:update", handler);
    };
  }, [merge, qc]);

  /** Pede a varredura. Devolve o estado imediato (cache, `queued` ou `running`). */
  const runScan = useCallback(
    async (kolId: string, force = false): Promise<ScanResult> => {
      const r = await requestScan(kolId, force);
      merge(toSummary(r));
      qc.setQueryData(scanKey(kolId), r);
      return r;
    },
    [merge, qc],
  );

  return { scans: data ?? {}, runScan };
}

/**
 * Resultado COMPLETO de um scan — só quando o modal do KOL abre.
 *
 * A listagem carrega apenas resumos; as evidências de 276 KOLs no page load
 * seriam centenas de KB que quase ninguém abre.
 */
export function useScan(kolId: string | null) {
  const { data } = useQuery({
    queryKey: scanKey(kolId ?? ""),
    queryFn: () => getScan(kolId!),
    enabled: Boolean(kolId),
    // 404 = KOL ainda não varrido; insistir não ajuda.
    retry: false,
  });
  return data ?? null;
}
