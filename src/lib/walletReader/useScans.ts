"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getScans, getScansOf, requestScan } from "@/lib/api/walletReader";
import { getSocket } from "@/lib/realtime/socket";
import type { ScanResult, ScanSummary } from "@/lib/walletReader/types";

/** Chave da query — o realtime chega por ela. */
export const SCANS_KEY = ["wallet-reader-scans"] as const;
/** Chave das varreduras COMPLETAS de um KOL (uma por carteira). */
export const scanKey = (kolId: string) => ["wallet-reader-scan", kolId] as const;

type ScanMap = Record<string, ScanSummary>;

/** Substitui (ou insere) a varredura daquela CARTEIRA na lista do KOL. */
function upsertScan(prev: ScanResult[] | undefined, r: ScanResult): ScanResult[] {
  const list = prev ?? [];
  const i = list.findIndex((x) => x.publicWallet === r.publicWallet);
  if (i === -1) return [r, ...list];
  const next = list.slice();
  next[i] = r;
  return next;
}

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

/**
 * Só o backend. Havia um fallback para um JSON em `public/`, mas arquivo em
 * `public/` é servido a QUALQUER um — e scans trazem carteiras de KOL, que são
 * recurso do Pro. Backend fora = lista vazia, não dado vazado.
 */
async function fetchScans(): Promise<ScanMap> {
  try {
    return await getScans();
  } catch {
    return {};
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
export function useScans(enabled = true) {
  const qc = useQueryClient();
  // `enabled=false` no FREE: o controller de scans é Pro e responderia 403.
  const { data } = useQuery({ queryKey: SCANS_KEY, queryFn: fetchScans, enabled });

  const merge = useCallback(
    (r: ScanSummary) =>
      qc.setQueryData<ScanMap>(SCANS_KEY, (prev) => ({ ...(prev ?? {}), [r.kolId]: r })),
    [qc],
  );

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    const handler = (r: ScanResult) => {
      if (!r?.kolId) return;
      // A lista guarda só o RESUMO; as evidências ficam com `useScans(kolId)`.
      merge(toSummary(r));
      qc.setQueryData<ScanResult[]>(scanKey(r.kolId), (prev) => upsertScan(prev, r));
    };
    socket.on("scan:update", handler);
    socket.connect();
    // Só remove o LISTENER: o socket é singleton da aba e o Radar também o usa —
    // desconectar aqui derrubaria o feed dele ao fechar o modal.
    return () => {
      socket.off("scan:update", handler);
    };
  }, [enabled, merge, qc]);

  /** Pede a varredura. Devolve o estado imediato (cache, `queued` ou `running`). */
  const runScan = useCallback(
    async (kolId: string, wallet?: string, force = false): Promise<ScanResult> => {
      const r = await requestScan(kolId, wallet, force);
      merge(toSummary(r));
      qc.setQueryData<ScanResult[]>(scanKey(kolId), (prev) => upsertScan(prev, r));
      return r;
    },
    [merge, qc],
  );

  return { scans: data ?? {}, runScan };
}

/**
 * Varreduras COMPLETAS de um KOL — uma por carteira já varrida. Só quando o
 * modal abre: a listagem carrega apenas resumos, e as evidências de 276 KOLs no
 * page load seriam centenas de KB que quase ninguém abre.
 */
export function useKolScans(kolId: string | null) {
  const { data } = useQuery({
    queryKey: scanKey(kolId ?? ""),
    queryFn: () => getScansOf(kolId!),
    enabled: Boolean(kolId),
    retry: false,
  });
  return data ?? [];
}
