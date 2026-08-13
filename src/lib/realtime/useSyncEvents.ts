"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "./socket";

/** Payload de `sync:update` empurrado pelo backend ao fim do sync de uma carteira OWN. */
export interface SyncUpdatePayload {
  walletId: string;
  status: "PENDING" | "SYNCED" | "ERROR";
  inserted: number;
}

/**
 * Tempo real (WebSocket) para o fim do sync de carteira — SUBSTITUI o polling.
 * Ao receber `sync:update`, invalida a lista de carteiras (status → sai de
 * "sincronizando") e as métricas (dashboard sai do vazio) — sem o usuário precisar
 * selecionar a carteira. `onUpdate` (opcional) recebe o payload para o caller
 * reagir (ex.: encerrar o estado "aguardando dados" da carteira recém-conectada).
 *
 * Só ativa autenticado. Conecta ao montar e desconecta ao desmontar/deslogar.
 * `onUpdate` é guardado em ref → trocar o callback NÃO re-assina o socket.
 */
export function useSyncEvents(
  enabled: boolean,
  onUpdate?: (payload: SyncUpdatePayload) => void,
): void {
  const queryClient = useQueryClient();
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();

    const handler = (payload: SyncUpdatePayload) => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-analytics"] });
      onUpdateRef.current?.(payload);
    };

    socket.on("sync:update", handler);
    socket.connect();

    return () => {
      socket.off("sync:update", handler);
      socket.disconnect();
    };
  }, [enabled, queryClient]);
}
