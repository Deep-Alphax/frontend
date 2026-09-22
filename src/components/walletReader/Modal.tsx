"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import { ScrollArea } from "@/components/ui/ScrollArea";
import { cn } from "@/lib/cn";

/** Overlay + painel centralizado. Fecha no X, clique fora e Esc. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  bodyClassName,
  bodyScroll = true,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Classes do corpo — p/ trocar a rolagem única por colunas que rolam sozinhas. */
  bodyClassName?: string;
  /** `false` quando o corpo é um layout de colunas que rolam sozinhas. */
  bodyScroll?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2 shadow-2xl shadow-black/50",
          className ?? "max-w-lg",
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-6 px-4">
          <div className="min-w-0 truncate text-base font-semibold text-gray-12">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>
        {bodyScroll ? (
          // Painel é `max-h` (altura não definida): o viewport encolhe como item
          // flex (`flex-1 min-h-0`) em vez de `h-full`, que não resolveria.
          <ScrollArea
            className={cn("flex min-h-0 flex-1 flex-col", bodyClassName)}
            viewportClassName="min-h-0 flex-1"
          >
            {children}
          </ScrollArea>
        ) : (
          <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
        )}
        {footer && <div className="shrink-0 border-t border-gray-6 p-4">{footer}</div>}
      </div>
    </div>
  );
}
