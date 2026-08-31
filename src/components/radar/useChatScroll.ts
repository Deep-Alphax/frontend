"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

/** Distância do fim (px) que ainda conta como "colado no fim". */
const NEAR_BOTTOM_PX = 80;
/**
 * Janela (ms) depois do primeiro conteúdo em que o fim é REIMPOSTO: imagens,
 * embeds e fontes só assentam alguns frames depois e a altura muda várias vezes
 * — sem isto a lista abre parada no meio. Só a interação do usuário encerra
 * a janela antes da hora.
 */
const SETTLE_MS = 1500;

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
 * e observa TAMBÉM o container, porque ele muda de altura por conta própria
 * (fontes, barra inferior, `dvh` no mobile) e aí o fim escapa sem nenhum evento
 * de scroll acontecer.
 *
 * Devolve `atBottom` e `unread` (botão flutuante de "ir para o fim", com a
 * contagem do que chegou enquanto o usuário lia mais acima) e `scrollToBottom`.
 * `atBottom` só muda ao cruzar o limiar — não re-renderiza a cada evento de
 * scroll.
 *
 * Performance: um listener de scroll passivo + um ResizeObserver; medições O(1).
 */
export function useChatScroll(
  scrollRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  opts: { firstId: string | undefined; lastId: string | undefined; count: number },
): { atBottom: boolean; unread: number; scrollToBottom: () => void } {
  const { firstId, lastId, count } = opts;
  const pinnedRef = useRef(true);
  const prevHeightRef = useRef(0);
  const prevCountRef = useRef(0);
  const prevFirstRef = useRef<string | undefined>(undefined);
  const prevLastRef = useRef<string | undefined>(undefined);
  // Fim da janela de assentamento + se o usuário já mexeu no scroll (encerra a
  // janela: rolar para cima na abertura tem que valer).
  const settleUntilRef = useRef(0);
  const userIntentRef = useRef(false);
  const [atBottom, setAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);

  const toBottom = useCallback((el: HTMLElement) => {
    el.scrollTop = el.scrollHeight;
    pinnedRef.current = true;
    setAtBottom(true);
    setUnread(0);
  }, []);

  /** Novas no fim com o usuário lendo acima → contagem do botão flutuante. */
  const bumpUnread = useCallback((n: number) => {
    setUnread((prev) => prev + Math.max(1, n));
  }, []);

  /** Ainda assentando o layout inicial e o usuário não interveio. */
  const settling = () => !userIntentRef.current && Date.now() < settleUntilRef.current;

  // Estado "colado no fim" — recalculado no scroll.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
      // Durante o assentamento, um deslocamento que o usuário não pediu é
      // desfeito (a altura mudou embaixo dele) em vez de desgrudar.
      if (!near && settling()) {
        toBottom(el);
        return;
      }
      pinnedRef.current = near;
      setAtBottom(near);
      if (near) setUnread(0);
    };
    // Interação real do usuário encerra a janela de assentamento.
    const onIntent = () => {
      userIntentRef.current = true;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onIntent, { passive: true });
    el.addEventListener("touchstart", onIntent, { passive: true });
    el.addEventListener("pointerdown", onIntent, { passive: true });
    el.addEventListener("keydown", onIntent);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onIntent);
      el.removeEventListener("touchstart", onIntent);
      el.removeEventListener("pointerdown", onIntent);
      el.removeEventListener("keydown", onIntent);
    };
  }, [scrollRef, toBottom]);

  // Re-gruda no fim quando a altura do CONTEÚDO ou do CONTAINER muda.
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (pinnedRef.current || settling()) toBottom(el);
    });
    ro.observe(content);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef, contentRef, toBottom]);

  // Ajuste de posição após cada mudança de conteúdo (antes da pintura).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prevCount = prevCountRef.current;
    const prependedOlder =
      prevCount > 0 && firstId !== undefined && firstId !== prevFirstRef.current;
    const appendedNewer = lastId !== undefined && lastId !== prevLastRef.current;

    if (count > 0 && prevCount === 0) {
      // Primeiro conteúdo (ou reset de busca) → fim. A janela de assentamento +
      // o ResizeObserver reforçam o alvo enquanto a altura ainda muda.
      userIntentRef.current = false;
      settleUntilRef.current = Date.now() + SETTLE_MS;
      toBottom(el);
    } else if (prependedOlder) {
      // Antigas entraram no topo → mantém o que o usuário estava vendo.
      el.scrollTop += el.scrollHeight - prevHeightRef.current;
    } else if (appendedNewer && pinnedRef.current) {
      // Novas no fim e usuário no fim → gruda no fim.
      toBottom(el);
    } else if (appendedNewer) {
      // Novas no fim com o usuário lendo acima → só conta (não move a rolagem).
      bumpUnread(count - prevCount);
    }

    prevCountRef.current = count;
    prevHeightRef.current = el.scrollHeight;
    prevFirstRef.current = firstId;
    prevLastRef.current = lastId;
  }, [scrollRef, firstId, lastId, count, toBottom, bumpUnread]);

  // Usado pelo botão flutuante: volta ao fim e regruda.
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = true;
    setAtBottom(true);
    setUnread(0);
    // Suave só em distância curta; longe demais, salta (evita animação eterna).
    if (distance > 2000) el.scrollTop = el.scrollHeight;
    else el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scrollRef]);

  return { atBottom, unread, scrollToBottom };
}
