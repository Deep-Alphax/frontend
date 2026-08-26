"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import type { RadarGroup, SourceSelection } from "@/components/radar/useRadarFeed";
import { fmtCount, groupColorFor, groupInitial } from "@/components/radar/groupAvatar";

interface SourcesRailProps {
  groups: RadarGroup[];
  selection: SourceSelection;
  onSelect: (selection: SourceSelection) => void;
}

/** Barra de acento à esquerda do item ativo (node 748:25282). */
function ActiveBar() {
  return (
    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-xl bg-principal-11" />
  );
}

/** Estado do flyout de canais aberto (qual servidor + posição). */
interface Flyout {
  group: RadarGroup;
  left: number;
  top: number;
}

/**
 * Rail vertical de "Fontes" (node Figma 748:25276), por SERVIDOR: cada servidor é
 * um avatar (foto do Discord ou inicial). Clicar ABRE um flyout à direita com os
 * subgrupos (canais) POR NOME — "Todo o servidor" + cada canal. O 1º item ("Todas
 * as fontes") junta tudo. Item ativo ganha barra de acento.
 */
export function SourcesRail({ groups, selection, onSelect }: SourcesRailProps) {
  const allActive = selection === null;
  const [flyout, setFlyout] = useState<Flyout | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  // Fecha o flyout ao clicar fora / Esc.
  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: MouseEvent) => {
      if (!flyoutRef.current?.contains(e.target as Node)) setFlyout(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFlyout(null);
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [flyout]);

  const openFlyout = (g: RadarGroup, el: HTMLButtonElement) => {
    const r = el.getBoundingClientRect();
    setFlyout((prev) =>
      prev?.group.key === g.key
        ? null
        : { group: g, left: r.right + 4, top: Math.min(r.top, window.innerHeight - 320) },
    );
  };

  const pick = (sel: SourceSelection) => {
    onSelect(sel);
    setFlyout(null);
  };

  return (
    <aside className="flex min-h-0 flex-col bg-gray-2 lg:h-full lg:border-r lg:border-gray-6">
      <div className="flex h-[46px] shrink-0 items-center justify-center">
        <h2 className="text-[12px] font-medium uppercase text-gray-11">Fontes</h2>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-3">
        {/* Todas as fontes (node 748:25277) */}
        <button
          type="button"
          onClick={() => pick(null)}
          aria-current={allActive ? "true" : undefined}
          aria-label="Todas as fontes"
          title="Todas as fontes"
          className={cn(
            "relative flex items-center justify-center px-2 py-2.5 transition-colors",
            allActive ? "bg-gray-3" : "hover:bg-gray-3/50",
          )}
        >
          {allActive && <ActiveBar />}
          <span className="relative flex size-9 shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/all-sources.svg" alt="" width={60} height={60} className="max-w-none" />
          </span>
        </button>

        {groups.map((g) => {
          const guildActive = selection?.kind === "guild" && selection.guild === g.key;
          const hasActiveChannel =
            selection?.kind === "channel" &&
            g.subgroups.some((s) => s.channelId === selection.channelId);
          const open = flyout?.group.key === g.key;
          const highlight = guildActive || hasActiveChannel || open;
          return (
            <button
              key={g.key ?? "__none__"}
              type="button"
              onClick={(e) => openFlyout(g, e.currentTarget)}
              aria-expanded={open}
              title={`${g.name} · ${fmtCount(g.count)}`}
              className={cn(
                "relative flex items-center justify-center border-t border-gray-6 px-2 py-2.5 transition-colors",
                highlight ? "bg-gray-3" : "hover:bg-gray-3/50",
              )}
            >
              {(guildActive || hasActiveChannel) && <ActiveBar />}
              {g.iconUrl ? (
                <span
                  className={cn(
                    "size-9 shrink-0 overflow-hidden rounded-xl transition-opacity",
                    highlight ? "opacity-100" : "opacity-90 hover:opacity-100",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.iconUrl} alt="" width={36} height={36} className="size-full object-cover" />
                </span>
              ) : (
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl text-base font-semibold text-gray-12 transition-opacity",
                    groupColorFor(g.name),
                    highlight ? "opacity-100" : "opacity-90 hover:opacity-100",
                  )}
                >
                  {groupInitial(g.name)}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Flyout dos canais (fixed → escapa o overflow da rail). */}
      {flyout && (
        <div
          ref={flyoutRef}
          className="fixed z-50 flex max-h-[70dvh] w-56 flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl shadow-black/40"
          style={{ left: flyout.left, top: flyout.top }}
        >
          <div className="shrink-0 border-b border-gray-6 px-3 py-2">
            <p className="truncate text-sm font-semibold text-gray-12">{flyout.group.name}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {/* Todo o servidor */}
            {(() => {
              const active =
                selection?.kind === "guild" && selection.guild === flyout.group.key;
              return (
                <button
                  type="button"
                  onClick={() => pick({ kind: "guild", guild: flyout.group.key })}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-3"
                >
                  <span className="truncate text-sm font-medium text-gray-12">Todo o servidor</span>
                  {active ? (
                    <Check className="size-4 shrink-0 text-principal-11" strokeWidth={2} />
                  ) : (
                    <span className="shrink-0 text-xs tabular-nums text-gray-11">
                      {fmtCount(flyout.group.count)}
                    </span>
                  )}
                </button>
              );
            })()}

            {/* Canais (subgrupos) por NOME */}
            {flyout.group.subgroups.map((s) => {
              const active =
                selection?.kind === "channel" && selection.channelId === s.channelId;
              return (
                <button
                  key={s.channelId}
                  type="button"
                  onClick={() => pick({ kind: "channel", channelId: s.channelId })}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-gray-3"
                >
                  <span className={cn("truncate text-sm", active ? "text-gray-12" : "text-gray-11")}>
                    {s.name}
                  </span>
                  {active ? (
                    <Check className="size-4 shrink-0 text-principal-11" strokeWidth={2} />
                  ) : (
                    <span className="shrink-0 text-xs tabular-nums text-gray-11">
                      {fmtCount(s.count)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
