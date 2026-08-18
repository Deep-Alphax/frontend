"use client";

import { createContext, useContext, useMemo } from "react";

import type { FavoriteAuthor } from "@/lib/api/feed";
import { useFavorites } from "@/components/radar/useFavorites";

/**
 * Mapa `authorTag → favorito` para resolver, em qualquer card, a personalização
 * (apelido/cor/foto) do autor seguido. A chave de follow (`FavoriteAuthor.authorId`)
 * guarda o `authorTag` — casa com `CapturedMessage.authorTag`.
 */
const FavoritesLookupContext = createContext<Map<string, FavoriteAuthor>>(new Map());

/**
 * Provê o mapa de favoritos a toda a árvore do Radar. Fonte única (`useFavorites`
 * já em cache) → um só assinante da query; os cards leem via contexto sem cada um
 * abrir sua própria subscrição.
 */
export function FavoritesLookupProvider({ children }: { children: React.ReactNode }) {
  const { favorites } = useFavorites();
  const map = useMemo(() => {
    const m = new Map<string, FavoriteAuthor>();
    for (const f of favorites) if (f.authorId) m.set(f.authorId, f);
    return m;
  }, [favorites]);
  return (
    <FavoritesLookupContext.Provider value={map}>{children}</FavoritesLookupContext.Provider>
  );
}

/** Favorito (personalização) de um autor pela tag; undefined se não seguido. */
export function useFavoriteFor(authorTag: string | null | undefined): FavoriteAuthor | undefined {
  const map = useContext(FavoritesLookupContext);
  return authorTag ? map.get(authorTag) : undefined;
}
