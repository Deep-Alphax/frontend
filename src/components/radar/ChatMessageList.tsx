"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown } from "lucide-react";

import type { CapturedMessage } from "@/lib/api/feed";
import { cn } from "@/lib/cn";
import { DURATION, EASE } from "@/lib/motion";
import { RadarMessageCard } from "@/components/radar/RadarMessageCard";
import { useChatScroll } from "@/components/radar/useChatScroll";
import { ScrollArea } from "@/components/ui/ScrollArea";

/** Rótulo do divisor de dia: "Hoje", "Ontem" ou "DD/MM". */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "2-digit" });
}

/**
 * Altura estimada de um card antes de medir. Só afeta a primeira pintura de um
 * item que ainda não apareceu: depois de medido, a altura real fica em cache
 * pelo id da mensagem (sobrevive a prepend de páginas antigas).
 */
const ESTIMATE_PX = 160;
const ESTIMATE_COMPACT_PX = 120;
/**
 * Cards renderizados além da área visível, para cada lado. Folga para rolagem
 * rápida sem "flash" de área vazia, sem voltar a montar a lista inteira.
 */
const OVERSCAN = 8;

function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-11">{label}</span>
      <span className="h-px flex-1 bg-gray-6" />
    </div>
  );
}

interface ChatMessageListProps {
  /** Mensagens em ordem NOVA→ANTIGA (como vêm do feed). Invertidas p/ exibir. */
  messages: CapturedMessage[];
  /** Há páginas mais ANTIGAS a carregar (topo). */
  hasOlder: boolean;
  isLoadingOlder: boolean;
  /** Carrega a próxima página de antigas (topo). */
  loadOlder: () => void;
  /** IDs chegados em tempo real — animam a entrada. */
  newIds?: Set<string>;
  onSelectAuthor?: (authorId: string, authorName: string) => void;
  /** Variantes do card (ver RadarMessageCard). */
  surface?: "card" | "list";
  compact?: boolean;
  nameAccent?: boolean;
  /** Divisores por dia (coluna central). Laterais usam a data no rodapé do card. */
  showDayDividers?: boolean;
  className?: string;
}

/**
 * Lista de mensagens estilo chat: mais ANTIGAS no topo, mais NOVAS no fundo.
 * Abre rolada no fim; ao rolar p/ CIMA (sentinela do topo) carrega as antigas
 * preservando a posição; realtime entra no fundo e "gruda" se o usuário estiver
 * no fim. A rolagem é da própria coluna (não da página).
 *
 * Recebe as mensagens em ordem nova→antiga (padrão do feed) e inverte só para
 * render — a fonte de dados continua "newest-first" (prepend de realtime O(1)).
 */
export function ChatMessageList({
  messages,
  hasOlder,
  isLoadingOlder,
  loadOlder,
  newIds,
  onSelectAuthor,
  surface = "list",
  compact = false,
  nameAccent = false,
  showDayDividers = false,
  className,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Ordem cronológica (antigo→novo) só p/ exibição.
  const chrono = useMemo(() => [...messages].slice().reverse(), [messages]);

  const rows = useMemo(
    () =>
      chrono.map((m, i) => {
        const label = dayLabel(m.createdAt);
        const prev = i > 0 ? dayLabel(chrono[i - 1].createdAt) : null;
        return { m, label, showDivider: showDayDividers && label !== prev };
      }),
    [chrono, showDayDividers],
  );

  /*
   * Virtualização: só os cards perto da área visível existem no DOM. Antes, cada
   * página carregada somava ~20 cards montados (com embeds, imagens e animação)
   * e uma sessão longa de rolagem chegava a centenas — o custo de layout e de
   * memória crescia sem teto.
   *
   * A ancoragem estilo chat continua no `useChatScroll`, sem mudança: ele
   * trabalha com `scrollHeight`, e o contêiner abaixo tem a altura TOTAL da
   * lista (`getTotalSize`), então "carregou antigas no topo" e "chegou nova no
   * fim" continuam aparecendo para ele como variação de altura. Quando um card
   * acima da área visível é medido com altura diferente da estimada, o próprio
   * virtualizer corrige a rolagem (não há "pulo").
   *
   * Trade-off: um card que sai da área visível desmonta — estado local dele
   * (popover aberto, mídia expandida) não sobrevive a rolar para longe e voltar.
   */
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    // Distância do topo do conteúdo rolável até a lista (o cabeçalho de
    // "carregando antigas" tem altura FIXA, então isso não varia).
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => (compact ? ESTIMATE_COMPACT_PX : ESTIMATE_PX),
    // Chave = id da mensagem: a altura medida acompanha o card quando páginas
    // antigas entram no topo e deslocam todos os índices.
    getItemKey: (i) => rows[i].m.id,
    overscan: OVERSCAN,
    scrollMargin,
    // Antes da 1ª medição (e no jsdom, que não mede nada) renderiza como se
    // houvesse uma coluna de altura típica, em vez de nenhuma linha.
    initialRect: { width: 0, height: 800 },
  });

  // `unread` = novas que chegaram no fim enquanto o usuário lia mais acima.
  const { atBottom, unread, scrollToBottom } = useChatScroll(scrollRef, contentRef, {
    firstId: chrono[0]?.id,
    lastId: chrono[chrono.length - 1]?.id,
    count: chrono.length,
  });

  // Carregar ANTIGAS ao aproximar do topo (sentinela no topo da coluna rolável).
  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || !hasOlder) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isLoadingOlder) loadOlder();
      },
      { root: scrollRef.current, rootMargin: "600px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasOlder, isLoadingOlder, loadOlder, chrono.length]);

  return (
    // Wrapper relativo: o botão "ir para o fim" flutua SOBRE a lista (dentro do
    // rolável ele rolaria junto com o conteúdo).
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      {/* `scrollRef` é o VIEWPORT (o elemento que rola): o useChatScroll e o
          IntersectionObserver da sentinela leem scrollTop/scrollHeight dele. */}
      <ScrollArea
        className="flex min-h-0 flex-1 flex-col"
        viewportRef={scrollRef}
        viewportClassName="min-h-0 flex-1 [overflow-anchor:none]"
      >
        {/* Wrapper observado pelo ResizeObserver (mede o crescimento do conteúdo). */}
        <div ref={contentRef}>
          {/* Topo: sentinela + estado de "carregando antigas". Altura FIXA:
              a lista virtual mede a distância até aqui uma vez só
              (`scrollMargin`), e um cabeçalho que cresce e some a cada página
              deslocaria todas as posições calculadas. */}
          <div ref={topSentinelRef} />
          <div className="flex h-11 items-center justify-center text-sm text-gray-11">
            {isLoadingOlder ? (
              <span className="flex items-center gap-2">
                <span>Loading more</span>
                <span className="flex gap-1">
                  <span className="size-1.5 animate-bounce rounded-full bg-principal-9 [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-6 [animation-delay:-0.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-gray-6" />
                </span>
              </span>
            ) : !hasOlder && chrono.length > 0 ? (
              <p className="text-xs">Start of history.</p>
            ) : null}
          </div>

          <div
            ref={listRef}
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((v) => {
              const { m, label, showDivider } = rows[v.index];
              return (
                <div
                  key={v.key}
                  data-index={v.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    "absolute left-0 top-0 w-full",
                    v.index === rows.length - 1 && "[&>article]:border-b-0",
                  )}
                  style={{ transform: `translateY(${v.start - scrollMargin}px)` }}
                >
                  {showDivider && <DayDivider label={label} />}
                  <RadarMessageCard
                    m={m}
                    surface={surface}
                    compact={compact}
                    nameAccent={nameAccent}
                    isNew={newIds?.has(m.id)}
                    onSelectAuthor={onSelectAuthor}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>

      <ScrollToBottomButton
        show={!atBottom && chrono.length > 0}
        unread={unread}
        compact={compact}
        onClick={scrollToBottom}
      />
    </div>
  );
}

/**
 * Botão flutuante "ir para o fim" — aparece quando o usuário sobe na conversa.
 * Com mensagens novas chegadas nesse meio-tempo, vira uma pílula com a contagem.
 */
function ScrollToBottomButton({
  show,
  unread,
  compact,
  onClick,
}: {
  show: boolean;
  unread: number;
  compact: boolean;
  onClick: () => void;
}) {
  const reduce = useReducedMotion();
  const hasUnread = unread > 0;

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={onClick}
          aria-label={
            hasUnread
              ? `Jump to the ${unread} new messages`
              : "Jump to the latest messages"
          }
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: DURATION.base, ease: EASE.out }}
          className={cn(
            "absolute z-10 flex items-center gap-1.5 rounded-full border shadow-lg",
            "text-sm font-semibold transition-colors",
            compact ? "bottom-3 right-3" : "bottom-4 right-4",
            hasUnread ? "h-9 px-3" : "size-9 justify-center",
            hasUnread
              ? "border-principal-8 bg-principal-9 text-gray-1 hover:bg-principal-10"
              : "border-gray-6 bg-gray-3 text-gray-12 hover:bg-gray-4",
          )}
        >
          {hasUnread && <span className="tabular-nums">{unread > 99 ? "99+" : unread}</span>}
          <ArrowDown className="size-4 shrink-0" strokeWidth={2.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
