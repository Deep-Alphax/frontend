"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { CopyKol, KolRef } from "@/lib/api/copyTrade";
import { usePlan } from "@/lib/billing/usePlan";
import { cn } from "@/lib/cn";
import { useCopyOverview } from "@/lib/copyTrade/useCopies";
import { useSnipeOverview } from "@/lib/devSnipe/useDevSnipe";
import { Topbar } from "@/components/home/Topbar";
import { ProLock } from "@/components/plans/ProLock";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { CopyConfigDrawer, type DrawerTarget } from "@/components/copyTrade/CopyConfigDrawer";
import { CopyTypeBar, type CopyType } from "@/components/copyTrade/CopyTypeBar";
import { DevSnipePanel } from "@/components/copyTrade/DevSnipePanel";
import { KolDetailPanel } from "@/components/copyTrade/KolDetailPanel";
import { MyCopiesColumn } from "@/components/copyTrade/MyCopiesColumn";
import { W1Modal } from "@/components/copyTrade/W1Modal";
import { WalletsToCopy } from "@/components/copyTrade/WalletsToCopy";

/** Copy da esquerda/feed só traz a referência do KOL; o painel completa com o detalhe. */
function refToKol(r: KolRef): CopyKol {
  const handle = r.label.startsWith("@") ? r.label.slice(1) : null;
  return {
    id: r.id,
    name: r.label,
    handle,
    relevance: r.relevance,
    types: [],
    avatarUrl: r.avatarUrl,
    stats: null,
    copiers: 0,
  };
}

/**
 * Copy Trade · Home (Figma 1578:26210 primeiro acesso, 1576:22569 com
 * copies, 1577:* estados da 3ª coluna e 1618:* drawer de configuração).
 * App-shell de altura total no desktop: cada coluna rola sozinha. Duas
 * colunas (312 · 1fr) e a 3ª de 420 px com uma carteira aberta; no celular a
 * 3ª cobre a tela.
 *
 * Só PRO (decisão 2026-10-20) — o backend barra (403); o FREE vê o upsell.
 * O modo de execução vem do servidor: em "shadow" tudo é marcado como
 * simulado, em "off" o copy é salvo mas não opera.
 *
 * Abas Wallet Copy / Dev Snipe (Figma 1638:34036): a aba fica na URL
 * (`?type=snipe`) para sobreviver ao reload. A troca usa
 * `history.replaceState` — integrado ao router do Next, sem navegação nem
 * entrada nova no histórico. `useSearchParams` pede o `<Suspense>` da página.
 */
export function CopyTradeScreen() {
  const { isPro, isLoading: planLoading } = usePlan();
  const enabled = isPro;
  const locked = !planLoading && !isPro;

  const params = useSearchParams();
  const [type, setType] = useState<CopyType>(() => (params?.get("type") === "snipe" ? "snipe" : "wallet"));
  const switchType = useCallback((t: CopyType) => {
    setType(t);
    const qs = new URLSearchParams(window.location.search);
    if (t === "snipe") qs.set("type", "snipe");
    else qs.delete("type");
    const q = qs.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
  }, []);

  const overview = useCopyOverview(enabled);
  const o = overview.data;
  // Fora da aba Dev Snipe só a contagem da aba usa o overview — sem polling.
  const snipes = useSnipeOverview(enabled, type === "snipe");
  const hasCopies = !!o && o.active.length + o.history.length > 0;

  const [open, setOpen] = useState<CopyKol | null>(null);
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [w1Open, setW1Open] = useState(false);
  const close = useCallback(() => setOpen(null), []);
  const openRef = useCallback((r: KolRef) => setOpen((cur) => (cur?.id === r.id ? cur : refToKol(r))), []);

  return (
    <div className="flex min-h-dvh flex-col bg-gray-1 lg:h-dvh lg:overflow-hidden">
      <Topbar />
      <CopyTypeBar type={type} onChange={switchType} copies={o?.active.length ?? 0} snipes={snipes.data?.waiting.length ?? 0} />
      <main className="relative flex-1 lg:min-h-0">
        {type === "snipe" ? (
          <DevSnipePanel
            enabled={enabled}
            locked={locked}
            overview={snipes.data}
            loading={planLoading || (enabled && snipes.isPending)}
          />
        ) : (
        <div
          aria-hidden={locked || undefined}
          className={cn(
            "flex flex-col lg:grid lg:h-full lg:grid-rows-[minmax(0,1fr)]",
            open ? "lg:grid-cols-[312px_minmax(0,1fr)_420px]" : "lg:grid-cols-[312px_minmax(0,1fr)]",
          )}
        >
          <ScrollArea className="border-gray-6 bg-gray-1 lg:h-full lg:border-r">
            <MyCopiesColumn
              overview={o}
              loading={enabled && overview.isLoading}
              selectedKolId={open?.id ?? null}
              onCreate={() => setDrawer({ kol: null })}
              onOpen={openRef}
            />
          </ScrollArea>

          <ScrollArea className="bg-gray-1 lg:h-full">
            <WalletsToCopy
              enabled={enabled}
              selectedId={open?.id ?? null}
              onOpen={setOpen}
              hasCopies={hasCopies}
              simulated={o?.mode === "shadow"}
              onOpenRef={openRef}
            />
          </ScrollArea>

          {open && enabled && (
            <div className="fixed inset-0 z-40 lg:static lg:z-auto lg:h-full lg:min-h-0">
              <KolDetailPanel
                key={open.id}
                kol={open}
                enabled={enabled}
                balanceSol={o?.w1?.balanceSol ?? null}
                onClose={close}
                onConfigure={setDrawer}
                onDeposit={() => setW1Open(true)}
              />
            </div>
          )}
        </div>
        )}

        {locked && (
          <div className="absolute inset-0 z-20 flex items-start justify-center bg-gray-1/70 px-4 pt-24 backdrop-blur-sm">
            <ProLock
              className="w-full max-w-lg bg-gray-2"
              title={type === "snipe" ? "Dev Snipe is part of Pro" : "Copy Trade is part of Pro"}
              detail={
                type === "snipe"
                  ? "Buy the next token of the devs whose launches migrate the most, in the first block."
                  : "See every KOL's verified 30-day track record and copy the wallets that hit the most."
              }
            />
          </div>
        )}
      </main>

      {drawer && enabled && type === "wallet" && (
        <CopyConfigDrawer
          key={`${drawer.kol?.id ?? "new"}:${drawer.copy?.id ?? ""}`}
          target={drawer}
          mode={o?.mode ?? "off"}
          balanceSol={o?.w1?.balanceSol ?? null}
          enabled={enabled}
          onClose={() => setDrawer(null)}
          onSaved={(ref) => {
            setDrawer(null);
            openRef(ref);
          }}
        />
      )}
      <W1Modal open={w1Open} onClose={() => setW1Open(false)} />
    </div>
  );
}
