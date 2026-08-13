"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFeedMessages, type CapturedMessage, type FeedPage } from "@/lib/api/feed";
import { getSocket } from "@/lib/realtime/socket";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

/** Formata ISO → local curto. */
function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function MessageCard({ m }: { m: CapturedMessage }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-6 bg-gray-1 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-11">
        <span className="font-medium text-gray-12">{m.authorTag || "—"}</span>
        <span>{m.guildName ? `${m.guildName} › #${m.channelName ?? ""}` : m.channelId}</span>
        <span className="ml-auto">{fmt(m.createdAt)}</span>
        <span
          className={
            "rounded-full px-2 py-0.5 font-medium " +
            (m.sentToTelegram ? "bg-green-10/20 text-green-11" : "bg-danger-10/20 text-danger-11")
          }
          title={m.telegramError ?? undefined}
        >
          {m.sentToTelegram ? "Telegram ✓" : "Telegram ✗"}
        </span>
      </div>

      <pre className="whitespace-pre-wrap break-words font-sans text-xs text-gray-12">
        {m.text}
      </pre>

      {m.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {m.links.map((l) => (
            <a
              key={l}
              href={l}
              target="_blank"
              rel="noopener noreferrer"
              className="max-w-full truncate rounded bg-gray-3 px-2 py-1 text-xs text-secundaria-11 hover:underline"
            >
              {l}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Feed de capturas (paginado, com busca por texto). */
export function FeedList() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const feedQuery = useQuery({
    queryKey: ["feed-messages", page, search],
    queryFn: () => getFeedMessages({ page, limit: 20, search: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const data = feedQuery.data;
  const items = data?.items ?? [];

  // Tempo real: novas capturas chegam por WebSocket e entram no topo (página 1, sem
  // filtro). Em outras páginas/filtros, ignora (aparecem ao voltar). Sem polling.
  useEffect(() => {
    const socket = getSocket();
    const onNew = (msg: CapturedMessage) => {
      if (page !== 1 || search) return;
      queryClient.setQueryData<FeedPage>(["feed-messages", 1, ""], (prev) => {
        if (!prev) return prev;
        if (prev.items.some((m) => m.id === msg.id)) return prev; // não duplica
        return {
          ...prev,
          items: [msg, ...prev.items].slice(0, prev.limit),
          total: prev.total + 1,
        };
      });
    };
    socket.on("feed:new", onNew);
    socket.connect();
    return () => {
      socket.off("feed:new", onNew);
    };
  }, [page, search, queryClient]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-2 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-12">
          Feed de capturas
        </h2>
        {data && <span className="text-sm text-gray-11">{data.total} no total</span>}
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <TextField
            label="Buscar no texto"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
            placeholder="ticker, contrato, palavra…"
          />
        </div>
        <Button className="w-auto" onClick={applySearch}>
          Buscar
        </Button>
      </div>

      {feedQuery.isLoading ? (
        <p className="text-sm text-gray-11">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-11">Nenhuma captura ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm text-gray-11">
          <Button
            variant="secondary"
            className="w-auto"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span>
            {data.page} / {data.totalPages}
          </span>
          <Button
            variant="secondary"
            className="w-auto"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </section>
  );
}
