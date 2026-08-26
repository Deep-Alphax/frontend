"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Ancoragem de rolagem estilo chat (novas embaixo). Mantém o fim visível quando
 * o usuário está no fim ("pinned"); ao carregar ANTIGAS no topo, preserva a
 * posição (sem "pulo"); no primeiro conteúdo, salta para o fim.
 *
 * `firstId`/`lastId` são os ids das pontas da lista JÁ em ordem cronológica
 * (antigo → novo). Comparar as pontas entre renders distingue prepend (antigas
 * no topo) de append (novas no fim) sem depender de flags do chamador.
 *
 * `contentRef` aponta o wrapper que CRESCE dentro do container rolável. Um
 * `ResizeObserver` re-gruda no fim quando a altura muda com o usuário no fim —
 * cobre o caso do refresh em que imagens/embeds/altura variável só assentam
 * DEPOIS do primeiro layout (o "pular pro fim" medido uma vez erra o alvo).
 *
 * Performance: um listener de scroll passivo + um ResizeObserver; medições O(1).
 */
export function useChatScroll(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  opts: { firstId: string | undefined; lastId: string | undefined; count: number },
): void {
  const { firstId, lastId, count } = opts;
  const pinnedRef = useRef(true);
  const prevHeightRef = useRef(0);
  const prevCountRef = useRef(0);
  const prevFirstRef = useRef<string | undefined>(undefined);
  const prevLastRef = useRef<string | undefined>(undefined);

  const toBottom = (el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
  };

  // Estado "colado no fim" — recalculado no scroll (limiar de 80px).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  // Re-gruda no fim quando a altura do conteúdo muda com o usuário no fim.
  // Resolve o refresh: o conteúdo assenta em vários frames (imagens, medição de
  // altura), e sem isto o scroll inicial para acima do fim real.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current) toBottom(el);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [scrollRef, contentRef]);

  // Ajuste de posição após cada mudança de conteúdo (antes da pintura).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevCount = prevCountRef.current;
    const prependedOlder =
      prevCount > 0 && firstId !== undefined && firstId !== prevFirstRef.current;
    const appendedNewer = lastId !== undefined && lastId !== prevLastRef.current;

    if (count > 0 && prevCount === 0) {
      // Primeiro conteúdo (ou reset de busca) → fim. O ResizeObserver reforça
      // o alvo nos frames seguintes conforme a altura assenta.
      pinnedRef.current = true;
      toBottom(el);
    } else if (prependedOlder) {
      // Antigas entraram no topo → mantém o que o usuário estava vendo.
      el.scrollTop += el.scrollHeight - prevHeightRef.current;
    } else if (appendedNewer && pinnedRef.current) {
      // Novas no fim e usuário no fim → gruda no fim.
      toBottom(el);
    }

    prevCountRef.current = count;
    prevHeightRef.current = el.scrollHeight;
    prevFirstRef.current = firstId;
    prevLastRef.current = lastId;
  }, [scrollRef, firstId, lastId, count]);
}
