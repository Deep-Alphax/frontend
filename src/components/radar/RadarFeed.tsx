"use client";

import { Fragment, useEffect, useRef } from "react";

import type { CapturedMessage } from "@/lib/api/feed";
import { RadarMessageCard } from "@/components/radar/RadarMessageCard";

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
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-11">
        {label}
      </span>
      <span className="h-px flex-1 bg-gray-6" />
    </div>
  );
}

interface RadarFeedProps {
  messages: CapturedMessage[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Nome do grupo selecionado (para a mensagem de vazio). `null` = todos. */
  selectedName: string | null;
  /** IDs chegados em tempo real — animam a entrada. */
  newIds: Set<string>;
  /** Seleciona o autor de uma mensagem (abre o perfil). */
  onSelectAuthor?: (authorId: string, authorName: string) => void;
}

/** Coluna central: feed de capturas com divisores por dia e scroll infinito. */
export function RadarFeed({
  messages,
  isLoading,
  isFetchingNextPage,
  hasMore,
  loadMore,
  selectedName,
  newIds,
  onSelectAuthor,
}: RadarFeedProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Scroll infinito: carrega a próxima página quando o sentinela entra na viewport.
  // Mais eficiente que polling/paginação manual e evita botão extra.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, messages.length]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-gray-6 bg-gray-2"
          />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-6 bg-gray-2 px-6 py-16 text-center">
        <p className="text-sm font-semibold text-gray-12">Nenhuma mensagem por aqui</p>
        <p className="max-w-sm text-xs text-gray-11">
          {selectedName
            ? `Ainda não há capturas de "${selectedName}".`
            : "As capturas dos grupos monitorados aparecem aqui em tempo real."}
        </p>
      </div>
    );
  }

  // Pré-calcula o rótulo do dia e onde entra o divisor — evita mutar variável
  // durante o render (regra de imutabilidade do React 19).
  const rows = messages.map((m, i) => {
    const label = dayLabel(m.createdAt);
    const prev = i > 0 ? dayLabel(messages[i - 1].createdAt) : null;
    return { m, label, showDivider: label !== prev };
  });

  return (
    <div className="flex flex-col gap-3">
      {rows.map(({ m, label, showDivider }) => (
        <Fragment key={m.id}>
          {showDivider && <DayDivider label={label} />}
          <RadarMessageCard m={m} isNew={newIds.has(m.id)} onSelectAuthor={onSelectAuthor} />
        </Fragment>
      ))}

      {/* Sentinela + estado de carregamento da próxima página */}
      <div ref={sentinelRef} />
      {isFetchingNextPage && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-11">
          <span>Carregando mais</span>
          <span className="flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-principal-9 [animation-delay:-0.2s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-gray-6 [animation-delay:-0.1s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-gray-6" />
          </span>
        </div>
      )}
      {!hasMore && (
        <p className="py-4 text-center text-xs text-gray-11">Você chegou ao fim.</p>
      )}
    </div>
  );
}
