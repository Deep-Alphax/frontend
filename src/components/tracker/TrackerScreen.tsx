"use client";

import { useCallback, useState } from "react";

import type {
  SourcePeriod,
  TokenRef,
  TrackerFeedFilters,
} from "@/lib/api/tracker";
import { usePlan } from "@/lib/billing/usePlan";
import { OpenTokenProvider } from "@/lib/tracker/tokenDrawer";
import {
  useConfluence,
  useDiscovery,
  useTopSources,
  useTrackerFilters,
  useTrackerRealtime,
} from "@/lib/tracker/useTracker";
import { Topbar } from "@/components/home/Topbar";
import { ProLock } from "@/components/plans/ProLock";
import { ConfluencePanel } from "@/components/tracker/ConfluencePanel";
import {
  DiscoveryPanel,
  TopSourcesPanel,
} from "@/components/tracker/SidePanels";
import { TokenDrawer } from "@/components/tracker/TokenDrawer";
import { WalletFeed, type FeedTab } from "@/components/tracker/WalletFeed";

/**
 * Tracker — SocialFi Wallet Tracker (Figma 1311:47443). App-shell de altura
 * total no desktop (cada coluna rola sozinha, como o Radar): Confluence ·
 * feed central · Top sources + Wallets Discovery. Proporções do Figma (1440):
 * 290 · 1fr · 290, gutter 24 e vão de 16.
 *
 * Só PRO (decisão 2026-10-01). Quem barra é o backend (403); aqui o FREE nem
 * dispara as consultas — vê a moldura vazia e o upsell.
 */
export function TrackerScreen() {
  const { isPro, isLoading: planLoading } = usePlan();
  const enabled = isPro;
  const locked = !planLoading && !isPro;

  const [filters, setFilters] = useState<TrackerFeedFilters>({});
  const [tab, setTab] = useState<FeedTab>("activity");
  const [period, setPeriod] = useState<SourcePeriod>("7d");
  // Drawer do token (Figma 1411:34396): qualquer token clicado na tela abre aqui.
  const [openToken, setOpenToken] = useState<TokenRef | null>(null);
  const closeToken = useCallback(() => setOpenToken(null), []);

  useTrackerRealtime(enabled);
  const confluence = useConfluence(enabled);
  const sources = useTopSources(period, enabled);
  const discovery = useDiscovery(enabled);
  const options = useTrackerFilters(enabled);

  const loading = (q: { isLoading: boolean }) =>
    planLoading || (enabled && q.isLoading);

  return (
    <OpenTokenProvider value={setOpenToken}>
      <div className="flex min-h-dvh flex-col bg-gray-1 lg:h-dvh lg:overflow-hidden">
        <Topbar />
        <main className="relative flex-1 lg:min-h-0">
          <div
            className="grid gap-4 px-4 py-4 sm:px-6 lg:h-full lg:grid-cols-[290px_minmax(0,1fr)_290px] lg:grid-rows-[minmax(0,1fr)]"
            aria-hidden={locked || undefined}
          >
            <WalletFeed
              className="order-1 max-h-[85dvh] lg:order-2 lg:max-h-none"
              filters={filters}
              onFilters={setFilters}
              options={options.data}
              tab={tab}
              onTab={setTab}
              enabled={enabled}
            />
            <ConfluencePanel
              className="order-2 max-h-[70dvh] lg:order-1 lg:max-h-none"
              items={confluence.data}
              isLoading={loading(confluence)}
            />
            <div className="order-3 flex min-h-0 flex-col gap-3">
              <TopSourcesPanel
                className="max-h-[60dvh] lg:max-h-none lg:basis-[369px] lg:shrink-0"
                items={sources.data}
                isLoading={loading(sources)}
                period={period}
                onPeriod={setPeriod}
                activeSource={filters.source}
                onSource={(source) => {
                  setFilters((f) => ({ ...f, source }));
                  setTab("activity");
                }}
              />
              <DiscoveryPanel
                className="max-h-[70dvh] lg:max-h-none lg:min-h-0 lg:flex-1"
                items={discovery.data}
                isLoading={loading(discovery)}
              />
            </div>
          </div>

          {locked && (
            <div className="absolute inset-0 z-20 flex items-start justify-center bg-gray-1/70 px-4 pt-24 backdrop-blur-sm">
              <ProLock
                className="w-full max-w-lg bg-gray-2"
                title="The Tracker is part of Pro"
                detail="Follow every KOL wallet in real time: trades, calls, confluence and the groups that hit the most."
              />
            </div>
          )}
        </main>
        {/* FREE não abre: o drawer é parte do Tracker (PRO) e o backend responde 403. */}
        <TokenDrawer token={enabled ? openToken : null} onClose={closeToken} />
      </div>
    </OpenTokenProvider>
  );
}
