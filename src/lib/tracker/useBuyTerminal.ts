"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Terminal onde o "Buy" abre tokens SOLANA (EVM sempre vai para o GMGN). */
export type BuyTerminal = "axiom" | "gmgn";

const KEY = "tracker:buyTerminal";
const EVENT = "tracker:buyTerminal";
const DEFAULT: BuyTerminal = "axiom";

function read(): BuyTerminal {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "gmgn" || v === "axiom" ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Preferência do "Quick buy" (por navegador). `useSyncExternalStore` deixa
 * todos os botões Buy da tela em sincronia sem contexto, e o SSR usa o padrão.
 */
export function useBuyTerminal(): [BuyTerminal, (t: BuyTerminal) => void] {
  const value = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const set = useCallback((t: BuyTerminal) => {
    try {
      window.localStorage.setItem(KEY, t);
    } catch {
      /* armazenamento bloqueado: vale só nesta renderização */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [value, set];
}
