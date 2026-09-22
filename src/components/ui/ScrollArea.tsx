"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { cn } from "@/lib/cn";

/*
 * ScrollArea do Deep Alpha — mesma API/anatomia do shadcn/ui (Radix), com o
 * estilo nos tokens do DS. Usa o scroll NATIVO por baixo (roda, toque, teclado,
 * acessibilidade); só a barra é desenhada, igual em todos os navegadores.
 *
 *   <ScrollArea className="h-80">…</ScrollArea>
 *   <ScrollArea orientation="horizontal">…</ScrollArea>
 *
 * Três armadilhas do Radix resolvidas aqui, para ninguém cair nelas de novo:
 *
 *  1. ALTURA: o Root só rola se tiver altura definida (`h-*`, `flex-1 min-h-0`).
 *     Para "cresce até X e então rola" (`max-h-*`), o limite tem que ir no
 *     VIEWPORT — use `viewportClassName="max-h-[70vh]"`. No Root, `max-h` não
 *     limita nada, porque o viewport é `size-full` de um pai sem altura.
 *  2. LARGURA: o Radix embrulha o conteúdo num `display: table; min-width: 100%`,
 *     que deixa filhos com `truncate`/`flex` estourarem a largura. O
 *     `[&>div]:!block` devolve o comportamento de bloco normal.
 *  3. REF: quem mede ou comanda o scroll (virtualização, "grudar no fim",
 *     setas de carrossel) precisa do elemento que ROLA, que é o viewport — não o
 *     Root. Por isso `viewportRef`.
 *  4. DENTRO DE COLUNA FLEX (modal com `max-h`, painel, chat): o pai só tem
 *     `max-h`, então `h-full` do viewport não resolve e o conteúdo é CORTADO
 *     sem rolar. Deixe o flex dar a altura:
 *       <ScrollArea className="flex min-h-0 flex-1 flex-col"
 *                   viewportClassName="min-h-0 flex-1">
 *  5. POSIÇÃO: o Radix força `position: relative` inline na raiz. O componente
 *     anula isso (classe `fixed`/`absolute` funciona), mas prefira deixar
 *     overlays e painéis deslizantes num wrapper próprio e o ScrollArea dentro
 *     com `size-full` — fica explícito quem posiciona e quem rola.
 */

type Orientation = "vertical" | "horizontal" | "both";

export interface ScrollAreaProps
  extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  /** Direção(ões) com barra. Padrão: vertical. */
  orientation?: Orientation;
  /** Ref do elemento que ROLA (use para scrollTop, virtualizer, ResizeObserver…). */
  viewportRef?: React.Ref<HTMLDivElement>;
  /** Classes do viewport — é aqui que vai `max-h-*` e o `overscroll-*`. */
  viewportClassName?: string;
  /** Repassados ao viewport (ex.: `onScroll`, `aria-label`, `role`, `tabIndex`). */
  viewportProps?: Omit<
    React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>,
    "ref" | "className" | "children"
  >;
}

export function ScrollArea({
  className,
  children,
  orientation = "vertical",
  viewportRef,
  viewportClassName,
  viewportProps,
  type = "hover",
  style,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      type={type}
      className={cn("relative overflow-hidden", className)}
      // O Radix grava `position: relative` INLINE na raiz, e inline vence
      // classe: `fixed`/`absolute`/`sticky` no className eram ignorados (o modal
      // de afiliados virou uma caixa solta no meio da página por isso). Anulado
      // aqui, quem decide é a classe — `relative` por padrão, acima.
      style={{ position: undefined, ...style }}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className={cn(
          "size-full rounded-[inherit] outline-none",
          "focus-visible:ring-2 focus-visible:ring-secundaria-11/40",
          "[&>div]:!block",
          viewportClassName,
        )}
        {...viewportProps}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      {orientation !== "horizontal" && <ScrollBar orientation="vertical" />}
      {orientation !== "vertical" && <ScrollBar orientation="horizontal" />}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "z-10 flex touch-none select-none p-px transition-colors",
        orientation === "vertical" && "h-full w-2 border-l border-l-transparent",
        orientation === "horizontal" && "h-2 flex-col border-t border-t-transparent",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-gray-6 transition-colors hover:bg-gray-8"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  );
}
