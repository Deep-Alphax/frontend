"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Topbar } from "@/components/home/Topbar";
import { SourcesRail } from "@/components/radar/SourcesRail";
import { RadarModuleBar } from "@/components/radar/RadarModuleBar";
import { RickBotPanel } from "@/components/radar/RickBotPanel";
import { RadarFeed } from "@/components/radar/RadarFeed";
import { ColumnResizer } from "@/components/radar/ColumnResizer";
import { FavoritesPanel } from "@/components/radar/FavoritesPanel";
import { ProfilePanel } from "@/components/radar/ProfilePanel";
import { ColumnDragHandle } from "@/components/radar/ColumnDragHandle";
import { useRadarFeed, type SourceSelection } from "@/components/radar/useRadarFeed";
import { FavoritesLookupProvider } from "@/components/radar/favoritesLookup";
import {
  COLUMN_ORDER_KEY,
  moveColumn,
  readColumnOrder,
  shiftColumn,
  type RadarColumnKey,
} from "@/components/radar/columnOrder";
import { cn } from "@/lib/cn";

/** Largura das colunas laterais 2/4 (px) — limites de arraste + default. */
const COL_MIN = 260;
const COL_MAX = 620;
const COL_DEFAULT = 340;
const clampCol = (w: number) => Math.min(COL_MAX, Math.max(COL_MIN, w));

/** Lê a largura persistida (guardado p/ SSR e localStorage bloqueado). */
function readCol(key: string): number {
  if (typeof window === "undefined") return COL_DEFAULT;
  try {
    const v = Number(window.localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? clampCol(v) : COL_DEFAULT;
  } catch {
    return COL_DEFAULT;
  }
}

/**
 * Tela de Radar (node Figma 748:25272): app-shell de largura e altura totais —
 * Topbar fixa + uma linha de 4 colunas que preenchem a viewport, cada uma com
 * rolagem própria (não a página):
 *  1) rail de "Fontes" (servidores) → seleciona a fonte ativa (controla o centro);
 *  2) "Rick Bot" — feed FIXO do usuário Rick#9725 (query própria por autor);
 *  3) "Feed principal" — a FONTE SELECIONADA na rail (recorte do pool por guildName);
 *  4) "Seus favoritos" (autores seguidos) / detalhes do perfil.
 *
 * As colunas 2–4 são reordenáveis pelo usuário (alça no header de cada painel):
 * a ordem é só a posição no grid — largura e divisórias seguem o SLOT, não o
 * painel, então o slot do meio é sempre o `1fr`. A rail fica sempre na esquerda.
 *
 * Proporções do Figma (1440): rail 69 · rick 382 · central 1fr · favoritos 382.
 * A busca do feed central é server-side (debounced). O feed central reaproveita o
 * pool (todas as capturas) filtrado por `guildName` — sem custo extra de rede.
 */
export function RadarScreen() {
  // Busca no feed central (mensagens/usuários) — debounced p/ não requisitar por tecla.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Seleção da rail: `null` (todas) · servidor (guild) · canal. Default = todas.
  const [selection, setSelection] = useState<SourceSelection>(null);

  // Canal selecionado → o feed central é buscado JÁ FILTRADO no backend (completo,
  // não só o que caiu no pool agregado). "Todas"/servidor usam o pool agregado.
  const activeChannelId = selection?.kind === "channel" ? selection.channelId : null;
  const feed = useRadarFeed(activeChannelId, search);

  // Autor selecionado → coluna direita mostra o perfil no lugar dos favoritos.
  const [selectedAuthor, setSelectedAuthor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Larguras redimensionáveis das colunas 2 (Rick) e 4 (favoritos); a central
  // absorve o `1fr`. Arraste nas duas divisórias da coluna central (ColumnResizer).
  // Inicializa com o valor persistido (lazy → SSR devolve o default). O grid usa
  // suppressHydrationWarning por causa do var de estilo (server=default vs client).
  const [leftW, setLeftW] = useState(() => readCol("radar:leftW"));
  const [rightW, setRightW] = useState(() => readCol("radar:rightW"));
  const dragStart = useRef(0); // largura no início do arraste (um por vez)

  // Persiste o tamanho escolhido (só escrita → sem setState no effect).
  useEffect(() => {
    try {
      localStorage.setItem("radar:leftW", String(leftW));
      localStorage.setItem("radar:rightW", String(rightW));
    } catch {
      // localStorage indisponível (modo privado/cota) — ignora.
    }
  }, [leftW, rightW]);

  // Ordem das colunas 2–4 escolhida pelo usuário (drag no header), persistida.
  // Inicializa lazy → no SSR devolve o default (daí o suppressHydrationWarning).
  const [order, setOrder] = useState<RadarColumnKey[]>(readColumnOrder);
  const [draggingKey, setDraggingKey] = useState<RadarColumnKey | null>(null);
  const dragKey = useRef<RadarColumnKey | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
    } catch {
      // localStorage indisponível (modo privado/cota) — ignora.
    }
  }, [order]);

  const handleDragStart = useCallback(
    (key: RadarColumnKey) => (e: React.DragEvent<HTMLButtonElement>) => {
      dragKey.current = key;
      setDraggingKey(key);
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", key); // Firefox exige um dado no dragstart
      } catch {
        // ignora
      }
    },
    [],
  );
  // Reordena AO VIVO ao entrar em outra coluna (a coluna alvo sai de baixo do
  // cursor, então os dragEnter seguintes caem na própria arrastada e são no-op).
  const handleDragEnter = useCallback(
    (target: RadarColumnKey) => () => {
      const from = dragKey.current;
      if (!from || from === target) return;
      setOrder((cur) => moveColumn(cur, from, target));
    },
    [],
  );
  const handleDragEnd = useCallback(() => {
    dragKey.current = null;
    setDraggingKey(null);
  }, []);
  const handleShift = useCallback(
    (key: RadarColumnKey) => (delta: -1 | 1) => setOrder((cur) => shiftColumn(cur, key, delta)),
    [],
  );

  // Feed central conforme a seleção: todas · servidor (guildName, recorte do pool)
  // · canal (o feed já vem filtrado do backend por channelId).
  const centerMessages = useMemo(() => {
    if (selection === null) return feed.messages;
    if (selection.kind === "guild")
      return feed.messages.filter((m) => (m.guildName ?? null) === selection.guild);
    return feed.messages;
  }, [feed.messages, selection]);

  // Nome da seleção (empty state do feed central).
  const selectedName = useMemo(() => {
    if (selection === null) return null;
    if (selection.kind === "guild")
      return feed.groups.find((g) => g.key === selection.guild)?.name ?? null;
    for (const g of feed.groups) {
      const s = g.subgroups.find((x) => x.channelId === selection.channelId);
      if (s) return s.name;
    }
    return null;
  }, [selection, feed.groups]);

  // Identidade estável p/ o memo do card não re-renderizar a cada render.
  const onSelectAuthor = useCallback(
    (id: string, name: string) => setSelectedAuthor({ id, name }),
    [],
  );

  // Alça de reordenar, injetada no header de cada painel.
  const dragHandle = (key: RadarColumnKey, label: string) => (
    <ColumnDragHandle
      label={label}
      dragging={draggingKey === key}
      onDragStart={handleDragStart(key)}
      onDragEnd={handleDragEnd}
      onShift={handleShift(key)}
    />
  );

  // Conteúdo de cada coluna reordenável, por chave (a posição vem de `order`).
  const columns: Record<RadarColumnKey, React.ReactNode> = {
    rick: <RickBotPanel onSelectAuthor={onSelectAuthor} dragHandle={dragHandle("rick", "Rick Bot")} />,
    feed: (
      <RadarFeed
        messages={centerMessages}
        isLoading={feed.isLoading}
        isFetchingNextPage={feed.isFetchingNextPage}
        hasMore={feed.hasMore}
        loadMore={feed.loadMore}
        selectedName={selectedName}
        newIds={feed.newIds}
        onSelectAuthor={onSelectAuthor}
        search={searchInput}
        onSearchChange={setSearchInput}
        dragHandle={dragHandle("feed", "Feed principal")}
      />
    ),
    favorites: selectedAuthor ? (
      <ProfilePanel
        author={selectedAuthor.id}
        authorName={selectedAuthor.name}
        onBack={() => setSelectedAuthor(null)}
        dragHandle={dragHandle("favorites", "Detalhes do perfil")}
      />
    ) : (
      <FavoritesPanel
        onSelectAuthor={onSelectAuthor}
        dragHandle={dragHandle("favorites", "Seus favoritos")}
      />
    ),
  };

  return (
    <FavoritesLookupProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-gray-1">
        <Topbar />

        {/* Linha de colunas — preenche a viewport. Em telas < lg, rola a página.
            Larguras das col. 2/4 via CSS var (só no template `lg:` — no mobile o
            grid-cols-1 vence e as vars ficam inertes). Slots fixos: o do meio é o
            `1fr`; quem ocupa cada slot é a ordem escolhida pelo usuário. */}
        <div
          suppressHydrationWarning
          className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[69px_var(--left-w)_minmax(0,1fr)_var(--right-w)] lg:overflow-hidden"
          style={{ "--left-w": `${leftW}px`, "--right-w": `${rightW}px` } as React.CSSProperties}
        >
          {/* 1 — Fontes (agrupadas por servidor) — fixa, fora da reordenação */}
          <SourcesRail groups={feed.groups} selection={selection} onSelect={setSelection} />

          {/* 2–4 — painéis reordenáveis; a divisória do slot redimensiona o vizinho */}
          {order.map((key, slot) => (
            <div
              key={key}
              onDragEnter={handleDragEnter(key)}
              onDragOver={(e) => {
                if (dragKey.current) e.preventDefault(); // habilita o drop nesta coluna
              }}
              onDrop={(e) => e.preventDefault()}
              className={cn(
                "relative min-h-0 lg:h-full",
                slot < 2 && "border-b border-gray-6 lg:border-b-0 lg:border-r",
                draggingKey === key && "opacity-60",
              )}
            >
              {columns[key]}
              {slot < 2 && (
                <ColumnResizer
                  onStart={() => (dragStart.current = slot === 0 ? leftW : rightW)}
                  onMove={(dx) =>
                    slot === 0
                      ? setLeftW(clampCol(dragStart.current + dx))
                      : setRightW(clampCol(dragStart.current - dx))
                  }
                />
              )}
            </div>
          ))}
        </div>

        {/* Barra inferior (substitui o footer) — module chips de métricas. */}
        <RadarModuleBar />
      </div>
    </FavoritesLookupProvider>
  );
}
