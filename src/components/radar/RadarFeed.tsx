"use client";

import { Search, X } from "lucide-react";

import type { CapturedMessage } from "@/lib/api/feed";
import { cn } from "@/lib/cn";
import { ChatMessageList } from "@/components/radar/ChatMessageList";

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
        placeholder="Buscar mensagem..."
        aria-label="Buscar mensagem..."
        className={cn(
          "h-9 w-full rounded-lg border border-gray-6 bg-gray-1 pl-9 pr-14",
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

/**
 * Coluna central: "Feed principal". Header + busca fixos no topo; o corpo é uma
 * lista estilo chat (novas embaixo, ver ChatMessageList) que rola sozinha.
 */
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
  const searching = search.trim().length > 0;

  return (
    <div className="flex max-h-[85dvh] min-h-0 flex-col border-b border-gray-6 lg:max-h-none lg:h-full lg:border-b-0 lg:border-r">
      {/* Header: título à esquerda + busca à direita */}
      <div className="flex h-[46px] shrink-0 items-center justify-between gap-3 border-b border-gray-6 bg-gray-2 px-4">
        <h2 className="shrink-0 text-base font-semibold text-gray-12">Feed principal</h2>
        <div className="w-full max-w-[320px]">
          <FeedSearch value={search} onChange={onSearchChange} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl border border-gray-6 bg-gray-2" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="mx-4 mb-4 flex flex-col items-center gap-2 rounded-xl border border-gray-6 bg-gray-2 px-6 py-16 text-center">
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
        <ChatMessageList
          messages={messages}
          hasOlder={hasMore}
          isLoadingOlder={isFetchingNextPage}
          loadOlder={loadMore}
          newIds={newIds}
          onSelectAuthor={onSelectAuthor}
          surface="list"
          showDayDividers
        />
      )}
    </div>
  );
}
