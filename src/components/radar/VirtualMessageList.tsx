"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { CapturedMessage } from "@/lib/api/feed";
import { RadarMessageCard } from "@/components/radar/RadarMessageCard";

interface VirtualMessageListProps {
  items: CapturedMessage[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onSelectAuthor?: (authorId: string, authorName: string) => void;
}

/**
 * Lista de cards virtualizada (painéis laterais). Só os cards visíveis ficam no
 * DOM — escala a centenas/milhares sem custo e sem "achatar" (medição dinâmica
 * via `measureElement` lida com a altura real, muito variável, de cada card).
 * Faz scroll infinito ao se aproximar do fim.
 */
export function VirtualMessageList({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onSelectAuthor,
}: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // +1 linha de "carregando" quando há próxima página.
  const count = hasNextPage ? items.length + 1 : items.length;

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    // Estimativa inicial; substituída pela altura real medida de cada card.
    estimateSize: () => 160,
    overscan: 6,
    // Gap de 12px entre cards embutido no espaçamento reservado.
    gap: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.length ? virtualItems[virtualItems.length - 1].index : 0;

  // Scroll infinito: aproximou-se do fim → busca a próxima página.
  useEffect(() => {
    if (lastIndex >= items.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [lastIndex, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto p-4">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((vi) => {
          const isLoader = vi.index >= items.length;
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              {isLoader ? (
                <div className="flex items-center justify-center py-3 text-xs text-gray-11">
                  Carregando mais…
                </div>
              ) : (
                <RadarMessageCard
                  m={items[vi.index]}
                  compact
                  onSelectAuthor={onSelectAuthor}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
