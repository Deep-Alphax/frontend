"use client";

import { useCallback, useState } from "react";

import type { SnipeOverview } from "@/lib/api/devSnipe";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { DevSnipeHome } from "@/components/copyTrade/DevSnipeHome";
import { SnipeConfigDrawer, type SnipeDrawerTarget } from "@/components/copyTrade/SnipeConfigDrawer";
import { SnipesColumn } from "@/components/copyTrade/SnipesColumn";

/**
 * Aba Dev Snipe (Figma 1633:33457): duas colunas (312 · 1fr), cada uma
 * rolando sozinha no desktop — mesmo app-shell do Wallet Copy. O drawer
 * cria (vazio ou com o dev do card) e ajusta snipes aguardando.
 */
export function DevSnipePanel({
  enabled,
  locked,
  overview,
  loading,
}: {
  enabled: boolean;
  locked: boolean;
  overview: SnipeOverview | undefined;
  loading: boolean;
}) {
  const [drawer, setDrawer] = useState<SnipeDrawerTarget | null>(null);
  const close = useCallback(() => setDrawer(null), []);

  return (
    <>
      <div aria-hidden={locked || undefined} className="flex flex-col lg:grid lg:h-full lg:grid-cols-[312px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
        <ScrollArea className="border-gray-6 bg-gray-1 lg:h-full lg:border-r">
          <SnipesColumn
            overview={overview}
            loading={loading}
            onCreate={() => setDrawer({})}
            onEdit={(snipe) => setDrawer({ snipe })}
          />
        </ScrollArea>
        <ScrollArea className="bg-gray-1 lg:h-full">
          <DevSnipeHome enabled={enabled} onSnipe={(dev) => setDrawer({ dev })} />
        </ScrollArea>
      </div>

      {drawer && enabled && (
        <SnipeConfigDrawer
          key={drawer.snipe?.id ?? drawer.dev ?? "new"}
          target={drawer}
          mode={overview?.mode ?? "off"}
          enabled={enabled}
          onClose={close}
        />
      )}
    </>
  );
}
