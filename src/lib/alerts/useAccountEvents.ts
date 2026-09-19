"use client";

import { useEffect } from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";

import {
  NOTIFICATIONS_KEY,
  UNREAD_KEY,
  type AppNotification,
  type NotificationsPage,
} from "@/lib/api/alerts";
import { PLAN_KEY } from "@/lib/api/billing";
import { getSocket } from "@/lib/realtime/socket";

/**
 * Eventos da CONTA pelo socket (sala `user:<id>`), sem polling:
 *
 *  - `notification:new` → entra no topo do sininho e soma no badge;
 *  - `plan:update` → o webhook confirmou (ou derrubou) a assinatura. Tudo que
 *    depende do plano muda — feed, KOLs, limites —, então invalida o cache
 *    inteiro: só as queries ATIVAS refazem, as outras só na próxima vez.
 *
 * Montado uma vez (no sininho do header, que só existe logado). Não desconecta
 * ao desmontar: o socket é singleton da aba e o Radar também o usa.
 */
export function useAccountEvents(enabled: boolean): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();

    const onNotification = (n: AppNotification) => {
      qc.setQueryData<number>(UNREAD_KEY, (prev) => (prev ?? 0) + 1);
      qc.setQueryData<InfiniteData<NotificationsPage, string | undefined>>(
        NOTIFICATIONS_KEY,
        (prev) => {
          if (!prev || prev.pages.length === 0) return prev;
          const [first, ...rest] = prev.pages;
          if (first.items.some((x) => x.id === n.id)) return prev;
          return {
            ...prev,
            pages: [{ ...first, items: [{ ...n, readAt: null }, ...first.items] }, ...rest],
          };
        },
      );
    };

    const onPlan = (p: { plan?: string }) => {
      if (p?.plan === "PRO" || p?.plan === "FREE") qc.setQueryData(PLAN_KEY, p.plan);
      qc.invalidateQueries();
    };

    socket.on("notification:new", onNotification);
    socket.on("plan:update", onPlan);
    socket.connect();
    return () => {
      socket.off("notification:new", onNotification);
      socket.off("plan:update", onPlan);
    };
  }, [enabled, qc]);
}
