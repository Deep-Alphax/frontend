"use client";

import { Fragment, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

import type { CapturedMessage } from "@/lib/api/feed";
import { cn } from "@/lib/cn";
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
  /** Termo de busca (mensagens/usuários). */
  search: string;
  onSearchChange: (value: string) => void;
}

/** Barra de busca do feed (mensagens ou usuários). Server-side, debounced. */
function FeedSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-11"
        strokeWidth={1.75}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar mensagens ou usuários..."
        aria-label="Buscar no feed"
        className={cn(
          "h-11 w-full rounded-lg border border-gray-6 bg-gray-2 pl-10 pr-10",
          "text-sm text-gray-12 placeholder:text-gray-11 outline-none",
          "focus-visible:border-secundaria-11/60 focus-visible:ring-2 focus-visible:ring-secundaria-11/30",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
        >
          <X className="size-4" strokeWidth={2} />
        </button>
      )}
    </div>
  );
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
  search,
  onSearchChange,
}: RadarFeedProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searching = search.trim().length > 0;

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

  // Pré-calcula o rótulo do dia e onde entra o divisor — evita mutar variável
  // durante o render (regra de imutabilidade do React 19).
  const rows = messages.map((m, i) => {
    const label = dayLabel(m.createdAt);
    const prev = i > 0 ? dayLabel(messages[i - 1].createdAt) : null;
    return { m, label, showDivider: label !== prev };
  });

  return (
    <div className="mx-auto flex max-w-153.5 w-full flex-col gap-3">
      {/* Busca — acima do divisor de data */}
      <FeedSearch value={search} onChange={onSearchChange} />

      {isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-xl border border-gray-6 bg-gray-2"
          />
        ))
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-6 bg-gray-2 px-6 py-16 text-center">
          <p className="text-sm font-semibold text-gray-12">
            {searching ? "Nenhum resultado" : "Nenhuma mensagem por aqui"}
          </p>
          <p className="max-w-sm text-xs text-gray-11">
            {searching
              ? `Nada encontrado para "${search.trim()}".`
              : selectedName
                ? `Ainda não há capturas de "${selectedName}".`
                : "As capturas dos grupos monitorados aparecem aqui em tempo real."}
          </p>
        </div>
      ) : (
        <>
          {rows.map(({ m, label, showDivider }) => (
            <Fragment key={m.id}>
              {showDivider && <DayDivider label={label} />}
              <RadarMessageCard
                m={m}
                isNew={newIds.has(m.id)}
                animateLayout
                onSelectAuthor={onSelectAuthor}
              />
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
        </>
      )}
    </div>
  );
}
