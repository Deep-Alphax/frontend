"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  addFavorite,
  getFavorites,
  removeFavorite,
  updateFavorite,
  uploadFavoritePhoto,
  type FavoriteAuthor,
  type UpdateFavoriteInput,
} from "@/lib/api/feed";

export const FAVORITES_KEY = ["radar-favorites"] as const;
export const FAVORITE_MESSAGES_KEY = ["radar-favorites-messages"] as const;

/**
 * Autores seguidos E personalizados, sincronizados com o backend (react-query).
 * A query traz as duas coisas na mesma linha (ver `FavoriteAuthor.followed`):
 * personalizar NÃO segue, então `favorites` (tudo, p/ pintar os cards) e
 * `followed` (o painel "Seus favoritos") são listas diferentes.
 *
 * Mutações otimistas: o botão de seguir responde na hora e reconcilia com o
 * servidor no settle; erro faz rollback. Fonte da verdade é a conta, não o device.
 */
export function useFavorites() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: FAVORITES_KEY,
    queryFn: getFavorites,
    staleTime: 60_000,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  // Só os SEGUIDOS (o resto da lista é personalização sem follow).
  const followed = useMemo(() => rows.filter((f) => f.followed), [rows]);
  const followedIds = useMemo(
    () => new Set(followed.map((f) => f.authorId)),
    [followed],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: FAVORITES_KEY });
    qc.invalidateQueries({ queryKey: FAVORITE_MESSAGES_KEY });
  };

  const add = useMutation({
    mutationFn: addFavorite,
    onMutate: async ({ authorId, authorTag }) => {
      await qc.cancelQueries({ queryKey: FAVORITES_KEY });
      const prev = qc.getQueryData<FavoriteAuthor[]>(FAVORITES_KEY);
      // Pode já existir uma linha só personalizada → vira seguida (não duplica).
      qc.setQueryData<FavoriteAuthor[]>(FAVORITES_KEY, (old = []) =>
        old.some((f) => f.authorId === authorId)
          ? old.map((f) => (f.authorId === authorId ? { ...f, followed: true } : f))
          : [
              {
                id: `tmp-${authorId}`,
                authorId,
                authorTag: authorTag ?? null,
                followed: true,
                nickname: null,
                color: null,
                photoUrl: null,
                createdAt: new Date().toISOString(),
              },
              ...old,
            ],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(FAVORITES_KEY, ctx.prev);
      toast.error("Não foi possível seguir");
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: removeFavorite,
    onMutate: async (authorId: string) => {
      await qc.cancelQueries({ queryKey: FAVORITES_KEY });
      const prev = qc.getQueryData<FavoriteAuthor[]>(FAVORITES_KEY);
      // Espelha o backend: com personalização a linha sobrevive (followed=false);
      // sem nada personalizado, some.
      qc.setQueryData<FavoriteAuthor[]>(FAVORITES_KEY, (old = []) =>
        old.flatMap((f) => {
          if (f.authorId !== authorId) return [f];
          const personalized = Boolean(f.nickname || f.color || f.photoUrl);
          return personalized ? [{ ...f, followed: false }] : [];
        }),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(FAVORITES_KEY, ctx.prev);
      toast.error("Não foi possível deixar de seguir");
    },
    onSettled: invalidate,
  });

  // Substitui (ou insere) o favorito retornado no cache da lista.
  const upsertCache = (fav: FavoriteAuthor) =>
    qc.setQueryData<FavoriteAuthor[]>(FAVORITES_KEY, (old = []) =>
      old.some((f) => f.authorId === fav.authorId)
        ? old.map((f) => (f.authorId === fav.authorId ? fav : f))
        : [fav, ...old],
    );

  // Personalização (apelido + cor) com update otimista + rollback.
  const update = useMutation({
    mutationFn: ({ authorId, input }: { authorId: string; input: UpdateFavoriteInput }) =>
      updateFavorite(authorId, input),
    onMutate: async ({ authorId, input }) => {
      await qc.cancelQueries({ queryKey: FAVORITES_KEY });
      const prev = qc.getQueryData<FavoriteAuthor[]>(FAVORITES_KEY);
      const patch = {
        ...(input.nickname !== undefined
          ? { nickname: input.nickname?.trim() || null }
          : {}),
        ...(input.color !== undefined ? { color: input.color ?? null } : {}),
      };
      qc.setQueryData<FavoriteAuthor[]>(FAVORITES_KEY, (old = []) =>
        old.some((f) => f.authorId === authorId)
          ? old.map((f) => (f.authorId === authorId ? { ...f, ...patch } : f))
          : // Autor ainda sem linha → personalizar cria uma NÃO seguida.
            [
              {
                id: `tmp-${authorId}`,
                authorId,
                authorTag: input.authorTag ?? authorId,
                followed: false,
                nickname: null,
                color: null,
                photoUrl: null,
                createdAt: new Date().toISOString(),
                ...patch,
              },
              ...old,
            ],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(FAVORITES_KEY, ctx.prev);
      toast.error("Não foi possível salvar");
    },
    onSuccess: (fav) => upsertCache(fav),
    onSettled: invalidate,
  });

  // Upload da foto: sem otimismo (bytes) — reconcilia com a resposta do servidor.
  const uploadPhoto = useMutation({
    mutationFn: ({ authorId, file }: { authorId: string; file: File }) =>
      uploadFavoritePhoto(authorId, file),
    onError: () => toast.error("Não foi possível enviar a foto"),
    onSuccess: (fav) => upsertCache(fav),
    onSettled: invalidate,
  });

  return {
    /** Tudo (seguidos + só personalizados) — usado para pintar os cards. */
    favorites: rows,
    /** Só os seguidos — o painel "Seus favoritos". */
    followed,
    count: followed.length,
    isLoading: query.isLoading,
    isFavorite: (authorId: string) => followedIds.has(authorId),
    getFavorite: (authorId: string) => rows.find((f) => f.authorId === authorId),
    toggle: (authorId: string, authorTag?: string | null) => {
      if (followedIds.has(authorId)) remove.mutate(authorId);
      else add.mutate({ authorId, authorTag });
    },
    isMutating: add.isPending || remove.isPending,
    /** Personaliza apelido + cor. */
    customize: (authorId: string, input: UpdateFavoriteInput) =>
      update.mutateAsync({ authorId, input }),
    /** Envia a foto do avatar. */
    uploadPhoto: (authorId: string, file: File) =>
      uploadPhoto.mutateAsync({ authorId, file }),
    isSaving: update.isPending || uploadPhoto.isPending,
  };
}
