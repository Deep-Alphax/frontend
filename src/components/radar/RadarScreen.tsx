"use client";

import { useCallback, useMemo, useState } from "react";

import { Topbar } from "@/components/home/Topbar";
import { GroupsPanel } from "@/components/radar/GroupsPanel";
import { RadarFeed } from "@/components/radar/RadarFeed";
import { FavoritesPanel } from "@/components/radar/FavoritesPanel";
import { ProfilePanel } from "@/components/radar/ProfilePanel";
import { useRadarFeed } from "@/components/radar/useRadarFeed";

/**
 * Tela de Radar (node Figma 492:9713): feed de capturas ao centro, grupos
 * (servidores Discord) à esquerda e favoritos à direita.
 *
 * O filtro por grupo é aplicado no cliente sobre as mensagens já carregadas —
 * a API de feed não expõe filtro por guild. Ao rolar, novas páginas engrossam
 * o mesmo pool, mantendo grupos e contagens coerentes.
 */
export function RadarScreen() {
  const feed = useRadarFeed();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // Autor selecionado → coluna direita mostra o perfil no lugar dos favoritos.
  const [selectedAuthor, setSelectedAuthor] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const visible = useMemo(() => {
    if (selectedKey === null) return feed.messages;
    return feed.messages.filter((m) => (m.guildName ?? null) === selectedKey);
  }, [feed.messages, selectedKey]);

  const selectedName =
    selectedKey === null
      ? null
      : (feed.groups.find((g) => g.key === selectedKey)?.name ?? selectedKey);

  // Identidade estável p/ o memo do card não re-renderizar a cada render.
  const onSelectAuthor = useCallback(
    (id: string, name: string) => setSelectedAuthor({ id, name }),
    [],
  );

  return (
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,300px)]">
          <div className="lg:sticky lg:top-8 lg:self-start">
            <GroupsPanel
              groups={feed.groups}
              loaded={feed.loaded}
              selectedKey={selectedKey}
              onSelect={setSelectedKey}
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
          />

          <div className="lg:sticky lg:top-8 lg:self-start">
            {selectedAuthor ? (
              <ProfilePanel
                authorId={selectedAuthor.id}
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
  );
}
