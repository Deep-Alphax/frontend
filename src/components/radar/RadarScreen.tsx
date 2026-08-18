"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Topbar } from "@/components/home/Topbar";
import { GroupsPanel } from "@/components/radar/GroupsPanel";
import { RadarFeed } from "@/components/radar/RadarFeed";
import { FavoritesPanel } from "@/components/radar/FavoritesPanel";
import { ProfilePanel } from "@/components/radar/ProfilePanel";
import { useRadarFeed, type RadarSelection } from "@/components/radar/useRadarFeed";
import { FavoritesLookupProvider } from "@/components/radar/favoritesLookup";

/**
 * Tela de Radar (node Figma 492:9713): feed de capturas ao centro, grupos
 * (servidores Discord) à esquerda e favoritos à direita.
 *
 * O filtro por grupo é aplicado no cliente sobre as mensagens já carregadas —
 * a API de feed não expõe filtro por guild. Ao rolar, novas páginas engrossam
 * o mesmo pool, mantendo grupos e contagens coerentes.
 */
export function RadarScreen() {
  // `null` = "Todos os grupos" (default ativo); grupo (guild) ou canal específico.
  const [selection, setSelection] = useState<RadarSelection>(null);
  // Busca no feed (mensagens/usuários) — debounced p/ não requisitar por tecla.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Canal selecionado → o feed central é buscado já filtrado no backend.
  const activeChannelId = selection?.type === "channel" ? selection.channelId : null;
  const feed = useRadarFeed(activeChannelId, search);
  // Autor selecionado → coluna direita mostra o perfil no lugar dos favoritos.
  const [selectedAuthor, setSelectedAuthor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const visible = useMemo(() => {
    if (selection == null) return feed.messages; // sem filtro (todos os grupos)
    if (selection.type === "group")
      return feed.messages.filter((m) => (m.guildName ?? null) === selection.guild);
    return feed.messages; // canal: o feed já vem filtrado por channelId do backend
  }, [feed.messages, selection]);

  const selectedName = useMemo(() => {
    if (selection == null) return null;
    if (selection.type === "group")
      return (
        feed.groups.find((g) => g.key === selection.guild)?.name ??
        selection.guild ??
        "Sem grupo"
      );
    // Canal: procura o subgrupo correspondente para exibir o rótulo (#canal).
    for (const g of feed.groups) {
      const sub = g.subgroups.find((s) => s.channelId === selection.channelId);
      if (sub) return sub.name;
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
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />

      <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-8 md:px-12 lg:px-0">
        {/* Cabeçalho da seção */}
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-display text-display-24 text-gray-12">
            Radar
          </h1>
          {feed.total > 0 && (
            <p className="text-sm text-gray-11 tabular-nums">
              {visible.length.toLocaleString("pt-BR")} de{" "}
              {feed.total.toLocaleString("pt-BR")} mensagens
            </p>
          )}
        </div>

        {/* 3 colunas em desktop; empilha em telas menores. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,264px)_minmax(0,1fr)_minmax(0,354px)]">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <GroupsPanel
              groups={feed.groups}
              total={feed.total}
              selection={selection}
              onSelect={setSelection}
            />
          </div>

          <RadarFeed
            messages={visible}
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

          <div className="lg:sticky lg:top-8 lg:self-start">
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
        </div>
      </main>
    </div>
    </FavoritesLookupProvider>
  );
}
