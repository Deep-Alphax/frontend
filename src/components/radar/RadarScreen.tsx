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
import { useRadarFeed, type SourceSelection } from "@/components/radar/useRadarFeed";
import { FavoritesLookupProvider } from "@/components/radar/favoritesLookup";

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

  return (
    <FavoritesLookupProvider>
      <div className="flex h-dvh flex-col overflow-hidden bg-gray-1">
        <Topbar />

        {/* Linha de colunas — preenche a viewport. Em telas < lg, rola a página.
            Larguras das col. 2/4 via CSS var (só no template `lg:` — no mobile o
            grid-cols-1 vence e as vars ficam inertes). */}
        <div
          suppressHydrationWarning
          className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[69px_var(--left-w)_minmax(0,1fr)_var(--right-w)] lg:overflow-hidden"
          style={{ "--left-w": `${leftW}px`, "--right-w": `${rightW}px` } as React.CSSProperties}
        >
          {/* 1 — Fontes (agrupadas por servidor) */}
          <SourcesRail groups={feed.groups} selection={selection} onSelect={setSelection} />

          {/* 2 — Rick Bot (feed fixo do usuário Rick#9725) — borda direita redimensiona */}
          <div className="relative min-h-0 lg:h-full">
            <RickBotPanel onSelectAuthor={onSelectAuthor} />
            <ColumnResizer
              onStart={() => (dragStart.current = leftW)}
              onMove={(dx) => setLeftW(clampCol(dragStart.current + dx))}
            />
          </div>

          {/* 3 — Feed principal (a fonte selecionada) — borda direita redimensiona os favoritos */}
          <div className="relative min-h-0 lg:h-full">
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
            />
            <ColumnResizer
              onStart={() => (dragStart.current = rightW)}
              onMove={(dx) => setRightW(clampCol(dragStart.current - dx))}
            />
          </div>

          {/* 4 — Favoritos / perfil */}
          {selectedAuthor ? (
            <ProfilePanel
              author={selectedAuthor.id}
              authorName={selectedAuthor.name}
              onBack={() => setSelectedAuthor(null)}
            />
          ) : (
            <FavoritesPanel onSelectAuthor={onSelectAuthor} />
          )}
        </div>

        {/* Barra inferior (substitui o footer) — module chips de métricas. */}
        <RadarModuleBar />
      </div>
    </FavoritesLookupProvider>
  );
}
