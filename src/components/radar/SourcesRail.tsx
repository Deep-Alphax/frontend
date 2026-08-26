"use client";

import { cn } from "@/lib/cn";
import type { RadarSource } from "@/components/radar/useRadarFeed";
import { fmtCount, groupColorFor, sourceInitial } from "@/components/radar/groupAvatar";

interface SourcesRailProps {
  sources: RadarSource[];
  /** Fonte ativa: `null` = "Todas as fontes" (feed central sem filtro); senão channelId. */
  activeKey: string | null;
  onSelect: (key: string | null) => void;
}

/** Barra de acento à esquerda do item ativo (node 748:25282). */
function ActiveBar() {
  return (
    <span className="absolute left-0 top-1/2 h-[25px] w-1 -translate-y-1/2 rounded-r-[12px] bg-principal-11" />
  );
}

/**
 * Rail vertical de "Fontes" (node Figma 748:25276): tiles quadrados arredondados
 * (38px), um por linha de 55px, SEM bordas entre itens. O item ativo mostra só a
 * barra de acento (principal-11). O 1º item ("Todas as fontes") junta tudo; os
 * demais são um CANAL monitorado cada (letra/emoji branca sobre cor por hash).
 */
export function SourcesRail({ sources, activeKey, onSelect }: SourcesRailProps) {
  return (
    <aside className="flex bg-gray-2 min-h-0 flex-col border-b border-gray-6 lg:h-full lg:border-b-0 lg:border-r">
      <div className="flex h-[46px] shrink-0 items-center justify-center">
        <h2 className="text-[12px] font-medium uppercase text-gray-11">
          Fontes
        </h2>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col">
        {/* Todas as fontes (node 748:25277) — junta tudo; feed central sem filtro. */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-current={activeKey === null ? "true" : undefined}
          aria-label="Todas as fontes"
          title="Todas as fontes"
          className="relative flex h-[55px] shrink-0 items-start justify-center px-3 py-2"
        >
          {activeKey === null && <ActiveBar />}
          <span
            className={cn(
              "relative flex size-[38px] shrink-0 items-center justify-center transition-opacity",
              activeKey === null ? "opacity-100" : "opacity-90 hover:opacity-100",
            )}
          >
            {/* Mascote do Deep Alpha (node 748:25278): tile 38px + brilho no
                viewBox 60×60 → render a 60px centralizado mantém o tile em 38px. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/all-sources.svg"
              alt=""
              width={60}
              height={60}
              className="max-w-none"
            />
          </span>
        </button>

        {sources.map((s) => {
          const active = activeKey === s.channelId;
          const label = s.guildName ? `${s.guildName} › ${s.name}` : s.name;
          return (
            <button
              key={s.channelId}
              type="button"
              onClick={() => onSelect(s.channelId)}
              aria-current={active ? "true" : undefined}
              aria-label={`${label} (${fmtCount(s.count)})`}
              title={`${label} · ${fmtCount(s.count)}`}
              className="relative flex h-[55px] shrink-0 items-start justify-center px-3 py-2"
            >
              {active && <ActiveBar />}
              <span
                className={cn(
                  "flex size-[38px] shrink-0 items-center justify-center rounded-[12px] text-base font-semibold text-gray-12 transition-opacity",
                  groupColorFor(s.name),
                  active ? "opacity-100" : "opacity-90 hover:opacity-100",
                )}
              >
                {sourceInitial(s.name)}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
