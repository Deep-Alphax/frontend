"use client";

import { useState, type DragEvent, type KeyboardEvent } from "react";

/*
 * Ordenar arrastando, sem dependência nova (HTML5 drag-and-drop nativo).
 *
 * - Enquanto arrasta, a ordem muda SÓ no cliente (otimista); a chamada ao
 *   servidor sai uma vez, ao soltar — não uma por linha atravessada.
 * - Teclado: com foco na alça, ↑/↓ move um passo e já salva. É a alternativa
 *   acessível (e o caminho em tela de toque, onde o drag nativo não existe).
 * - A ordem local fica presa à ordem do servidor que a originou (`base`): quando
 *   o refetch traz a lista nova, a local é descartada sozinha, sem efeito.
 */

interface LocalOrder {
  base: string;
  ids: string[];
}

export function useDragReorder<T extends { id: string }>(
  items: T[],
  /**
   * Salva a ordem nova. Se devolver uma Promise que rejeita (ex.:
   * `mutation.mutateAsync`), a ordem otimista é desfeita sozinha — quem chama
   * não precisa de `reset`, o que evitaria o ciclo hook ↔ mutação.
   */
  onCommit: (ids: string[]) => unknown,
  { disabled = false }: { disabled?: boolean } = {},
) {
  const serverIds = items.map((i) => i.id);
  const serverKey = serverIds.join("|");
  const [local, setLocal] = useState<LocalOrder | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const ids = local && local.base === serverKey ? local.ids : serverIds;
  const byId = new Map(items.map((i) => [i.id, i]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((x): x is T => x !== undefined);

  const commit = (next: string[]) => {
    if (next.join("|") === serverKey) return;
    const result = onCommit(next);
    if (result instanceof Promise) result.catch(() => setLocal(null));
  };

  /**
   * Move `id` para o lugar de `overId`. Só troca quando o cursor passa do MEIO
   * do alvo na direção do movimento: com itens de alturas diferentes (seções de
   * categoria), trocar logo na borda deixaria o cursor em cima do outro item e
   * os dois ficariam trocando de lugar sem parar.
   */
  const moveOver = (id: string, overId: string, e: DragEvent) => {
    if (id === overId) return;
    const from = ids.indexOf(id);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect?.();
    // Sem layout (jsdom, elemento oculto) a altura é 0: não há meio a medir.
    if (rect && rect.height > 0) {
      const middle = rect.top + rect.height / 2;
      if (from < to && e.clientY < middle) return;
      if (from > to && e.clientY > middle) return;
    }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, id);
    setLocal({ base: serverKey, ids: next });
  };

  const itemProps = (id: string) => ({
    draggable: !disabled,
    "data-dragging": draggingId === id ? "true" : undefined,
    onDragStart: (e: DragEvent) => {
      if (disabled) return;
      setDraggingId(id);
      // Firefox só inicia o drag com algum dado no dataTransfer.
      e.dataTransfer?.setData("text/plain", id);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent) => {
      if (!draggingId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      moveOver(draggingId, id, e);
    },
    onDrop: (e: DragEvent) => {
      if (draggingId) e.preventDefault();
    },
    onDragEnd: (e: DragEvent) => {
      setDraggingId(null);
      // Soltou fora da lista (ou Esc): o navegador marca "none" — desfaz.
      if (e.dataTransfer && e.dataTransfer.dropEffect === "none") {
        setLocal(null);
        return;
      }
      commit(ids);
    },
  });

  const handleProps = (id: string) => ({
    onKeyDown: (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const from = ids.indexOf(id);
      const to = from + (e.key === "ArrowUp" ? -1 : 1);
      if (from < 0 || to < 0 || to >= ids.length) return;
      const next = [...ids];
      [next[from], next[to]] = [next[to], next[from]];
      setLocal({ base: serverKey, ids: next });
      commit(next);
    },
  });

  return { ordered, itemProps, handleProps, draggingId };
}

type Reorder = ReturnType<typeof useDragReorder>;
/** Props da linha arrastável (espalhar no elemento da linha). */
export type DragItemProps = ReturnType<Reorder["itemProps"]>;
/** Props da alça (espalhar no `DragHandle`). */
export type DragHandleProps = ReturnType<Reorder["handleProps"]>;
