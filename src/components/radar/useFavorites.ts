"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  addFavorite,
  getFavorites,
  removeFavorite,
  type FavoriteAuthor,
} from "@/lib/api/feed";

export const FAVORITES_KEY = ["radar-favorites"] as const;
export const FAVORITE_MESSAGES_KEY = ["radar-favorites-messages"] as const;

/**
 * Autores favoritos ("seguidos"), sincronizados com o backend (react-query).
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

  const ids = useMemo(
    () => new Set((query.data ?? []).map((f) => f.authorId)),
    [query.data],
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
      qc.setQueryData<FavoriteAuthor[]>(FAVORITES_KEY, (old = []) =>
        old.some((f) => f.authorId === authorId)
          ? old
          : [
              {
                id: `tmp-${authorId}`,
                authorId,
                authorTag: authorTag ?? null,
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
      qc.setQueryData<FavoriteAuthor[]>(FAVORITES_KEY, (old = []) =>
        old.filter((f) => f.authorId !== authorId),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(FAVORITES_KEY, ctx.prev);
      toast.error("Não foi possível deixar de seguir");
    },
    onSettled: invalidate,
  });

  return {
    favorites: query.data ?? [],
    count: query.data?.length ?? 0,
    isLoading: query.isLoading,
    isFavorite: (authorId: string) => ids.has(authorId),
    toggle: (authorId: string, authorTag?: string | null) => {
      if (ids.has(authorId)) remove.mutate(authorId);
      else add.mutate({ authorId, authorTag });
    },
    isMutating: add.isPending || remove.isPending,
  };
}
