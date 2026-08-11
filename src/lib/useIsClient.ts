"use client";

import { useSyncExternalStore } from "react";

// Store trivial: nunca notifica. getServerSnapshot=false, getSnapshot=true.
const subscribe = () => () => {};

/**
 * `false` no servidor e no PRIMEIRO render do cliente (bate com o SSR → sem
 * hydration mismatch); `true` logo após, via o mecanismo do `useSyncExternalStore`
 * (React reconcilia sem warning). Use para adiar qualquer coisa que dependa do
 * browser (ex.: ler `document.cookie`) até depois da hidratação.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
