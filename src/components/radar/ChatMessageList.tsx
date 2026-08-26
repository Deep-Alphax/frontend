"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";

import type { CapturedMessage } from "@/lib/api/feed";
import { cn } from "@/lib/cn";
import { RadarMessageCard } from "@/components/radar/RadarMessageCard";
import { useChatScroll } from "@/components/radar/useChatScroll";

/** Rótulo do divisor de dia: "Hoje", "Ontem" ou "DD/MM". */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

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
  /** Mostra o chip do CA (copia ao clicar) — capturas do Rick Bot. */
  showCa?: boolean;
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
  showCa = false,
  showDayDividers = false,
  className,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

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

  useChatScroll(scrollRef, contentRef, {
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
    <div
      ref={scrollRef}
      className={cn("min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]", className)}
    >
      {/* Wrapper observado pelo ResizeObserver (mede o crescimento do conteúdo). */}
      <div ref={contentRef}>
        {/* Topo: sentinela + estado de "carregando antigas" */}
        <div ref={topSentinelRef} />
        {isLoadingOlder && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-11">
            <span>Carregando mais</span>
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-principal-9 [animation-delay:-0.2s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-gray-6 [animation-delay:-0.1s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-gray-6" />
            </span>
          </div>
        )}
        {!hasOlder && chrono.length > 0 && (
          <p className="py-3 text-center text-xs text-gray-11">Início do histórico.</p>
        )}

        {rows.map(({ m, label, showDivider }) => (
          <Fragment key={m.id}>
            {showDivider && <DayDivider label={label} />}
            <RadarMessageCard
              m={m}
              surface={surface}
              compact={compact}
              nameAccent={nameAccent}
              showCa={showCa}
              isNew={newIds?.has(m.id)}
              onSelectAuthor={onSelectAuthor}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
