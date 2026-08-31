"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { FavoriteAuthor } from "@/lib/api/feed";
import { useFavorites } from "@/components/radar/useFavorites";
import { UserCustomizeModal } from "@/components/radar/UserCustomizeModal";

/**
 * Mapa `authorTag → personalização` para resolver, em qualquer card, o apelido/
 * cor/foto do autor. A chave (`FavoriteAuthor.authorId`) guarda o `authorTag` —
 * casa com `CapturedMessage.authorTag`. Inclui autores apenas PERSONALIZADOS
 * (sem follow), por isso a lista completa e não só os seguidos.
 */
const FavoritesLookupContext = createContext<Map<string, FavoriteAuthor>>(new Map());

/** Autor a personalizar (alvo do modal). */
interface CustomizeTarget {
  /** Chave de personalização = `CapturedMessage.authorTag`. */
  authorTag: string;
  /** Nome exibido na mensagem (valor inicial do modal). */
  name: string;
  /** Grupo do autor (subtítulo do modal). */
  group: string | null;
}

/** Abre o modal "Personalizar usuário" para um autor — seguir não é preciso. */
const CustomizeContext = createContext<(target: CustomizeTarget) => void>(() => {});

/**
 * Provê o mapa de personalizações a toda a árvore do Radar E o modal de
 * personalizar, em UMA instância. Fonte única (`useFavorites` já em cache) → um
 * só assinante da query e um só modal montado; os cards leem/abrem via contexto
 * sem cada um abrir sua própria subscrição.
 */
export function FavoritesLookupProvider({ children }: { children: React.ReactNode }) {
  const { favorites, customize, uploadPhoto, isSaving } = useFavorites();
  const map = useMemo(() => {
    const m = new Map<string, FavoriteAuthor>();
    for (const f of favorites) if (f.authorId) m.set(f.authorId, f);
    return m;
  }, [favorites]);

  const [target, setTarget] = useState<CustomizeTarget | null>(null);
  const openCustomize = useCallback((t: CustomizeTarget) => setTarget(t), []);
  const close = useCallback(() => setTarget(null), []);

  const current = target ? map.get(target.authorTag) : undefined;

  // `authorTag` no PATCH: quando ainda NÃO existe linha, o backend cria uma só
  // com a personalização (followed=false) e precisa da tag para exibição.
  const onSave = useCallback(
    (input: { nickname: string | null; color: string | null }) =>
      target
        ? customize(target.authorTag, { ...input, authorTag: target.authorTag })
        : Promise.resolve(),
    [target, customize],
  );
  const onUploadPhoto = useCallback(
    (file: File) => (target ? uploadPhoto(target.authorTag, file) : Promise.resolve()),
    [target, uploadPhoto],
  );

  return (
    <FavoritesLookupContext.Provider value={map}>
      <CustomizeContext.Provider value={openCustomize}>
        {children}
        <UserCustomizeModal
          open={target !== null}
          authorName={target?.name ?? ""}
          group={target?.group ?? null}
          favorite={current}
          onClose={close}
          onSave={onSave}
          onUploadPhoto={onUploadPhoto}
          isSaving={isSaving}
        />
      </CustomizeContext.Provider>
    </FavoritesLookupContext.Provider>
  );
}

/** Personalização de um autor pela tag; undefined se nunca foi personalizado. */
export function useFavoriteFor(authorTag: string | null | undefined): FavoriteAuthor | undefined {
  const map = useContext(FavoritesLookupContext);
  return authorTag ? map.get(authorTag) : undefined;
}

/** Abre o modal de personalizar para um autor (sem precisar segui-lo). */
export function useCustomizeAuthor(): (target: CustomizeTarget) => void {
  return useContext(CustomizeContext);
}
