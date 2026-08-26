"use client";

import { useCallback, useEffect, useState } from "react";

import type { ScanResult } from "@/lib/walletReader/types";

const SCANS_URL = "/wallet-reader/sidewallet-scans.json";

// Cache dos scans cacheados entre montagens.
let scansCache: Record<string, ScanResult> | null = null;

/**
 * Scans de sidewallets/copytraders: carrega os resultados JÁ cacheados (JSON) e
 * expõe um `runScan` que dispara a varredura ao vivo no backend. A varredura
 * depende do `gmgn-cli` instalado/autenticado no host do backend (ver Fase 3).
 */
export function useScans() {
  const [scans, setScans] = useState<Record<string, ScanResult>>(scansCache ?? {});

  useEffect(() => {
    if (scansCache) return;
    let alive = true;
    // Fonte primária: backend (DB). Fallback: JSON estático em public/ (offline).
    (async () => {
      try {
        const { api } = await import("@/lib/api/client");
        const { data } = await api.get<{ scans?: Record<string, ScanResult> }>(
          "/api/v1/wallet-reader/scans",
        );
        if (!alive) return;
        const map = data.scans ?? {};
        scansCache = map;
        setScans(map);
        return;
      } catch {
        // backend indisponível → cai no JSON estático
      }
      try {
        const r = await fetch(SCANS_URL);
        const data = r.ok ? await r.json() : { scans: {} };
        if (!alive) return;
        const map: Record<string, ScanResult> = data.scans ?? {};
        scansCache = map;
        setScans(map);
      } catch {
        /* sem scans */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Dispara a varredura ao vivo no backend e mescla o resultado no cache local. */
  const runScan = useCallback(async (kolId: string): Promise<ScanResult> => {
    const { api } = await import("@/lib/api/client");
    const { data } = await api.post<ScanResult>(
      `/api/v1/wallet-reader/scan/${encodeURIComponent(kolId)}`,
    );
    scansCache = { ...(scansCache ?? {}), [kolId]: data };
    setScans(scansCache);
    return data;
  }, []);

  return { scans, runScan };
}
