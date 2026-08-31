"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";

interface ColumnResizerProps {
  /** Snapshot da largura atual no início do arraste. */
  onStart: () => void;
  /** Delta horizontal (px) desde o início do arraste. */
  onMove: (dx: number) => void;
}

/**
 * Alça de redimensionar coluna — faixa fina na divisória entre dois painéis.
 * Arrastar emite o delta horizontal; o pai aplica à largura da coluna (via CSS
 * var no grid). Pointer capture no window → o arraste segue mesmo fora da faixa.
 *
 * A faixa fica INTEIRA à direita da divisória (`translate-x-1/2`), sobre a
 * margem do painel seguinte. Centrada, ela cobria a scrollbar da coluna — que
 * mora exatamente na borda direita — e roubava o clique de quem só queria rolar.
 * Do lado de fora não há scrollbar (em LTR), então os dois gestos convivem.
 *
 * Só em desktop (`lg`); a faixa acende no hover para dizer onde pegar.
 */
export function ColumnResizer({ onStart, onMove }: ColumnResizerProps) {
  const startX = useRef(0);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    startX.current = e.clientX;
    onStart();

    const move = (ev: PointerEvent) => onMove(ev.clientX - startX.current);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar coluna"
      onPointerDown={handlePointerDown}
      className="absolute right-0 top-0 z-20 hidden h-full w-2 translate-x-1/2 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-gray-6/60 lg:block"
    />
  );
}
