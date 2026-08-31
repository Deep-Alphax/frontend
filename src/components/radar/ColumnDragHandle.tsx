"use client";

import { GripVertical } from "lucide-react";
import type { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn } from "@/lib/cn";

interface ColumnDragHandleProps {
  /** Nome da coluna (rótulo de acessibilidade). */
  label: string;
  /** Esta coluna é a que está sendo arrastada. */
  dragging: boolean;
  onDragStart: (e: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
  /** Alternativa por teclado: -1 move p/ a esquerda, 1 p/ a direita. */
  onShift: (delta: -1 | 1) => void;
}

/**
 * Alça de reordenar coluna — vive no header do painel. Arrastar sobre outra
 * coluna troca as posições ao vivo (HTML5 DnD, mesmo idioma dos chips da
 * RadarModuleBar); ←/→ com o foco na alça movem sem mouse. Só em desktop (`lg`):
 * no mobile as colunas viram linhas empilhadas e a ordem não importa.
 */
export function ColumnDragHandle({
  label,
  dragging,
  onDragStart,
  onDragEnd,
  onShift,
}: ColumnDragHandleProps) {
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    onShift(e.key === "ArrowLeft" ? -1 : 1);
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={handleKeyDown}
      title={`Arrastar para reordenar · ${label}`}
      aria-label={`Reordenar coluna ${label} (arraste ou use as setas esquerda/direita)`}
      className={cn(
        "-ml-1 hidden size-6 shrink-0 items-center justify-center rounded-md text-gray-11 transition-colors lg:flex",
        "cursor-grab hover:bg-gray-4 hover:text-gray-12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-principal-9",
        dragging && "cursor-grabbing bg-gray-4 text-gray-12",
      )}
    >
      <GripVertical className="size-4" strokeWidth={2} aria-hidden />
    </button>
  );
}
