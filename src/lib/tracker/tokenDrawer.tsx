"use client";

import { createContext, useContext } from "react";

import type { TokenRef } from "@/lib/api/tracker";

/**
 * Abre o drawer do token de qualquer lugar do Tracker (card do feed,
 * Confluence, Multi Buys, Net Flows, Discovery) sem passar callback por
 * todas as camadas. Fora do provider é um no-op (ex.: testes isolados).
 */
const OpenTokenContext = createContext<(token: TokenRef) => void>(() => {});

export const OpenTokenProvider = OpenTokenContext.Provider;

export function useOpenToken(): (token: TokenRef) => void {
  return useContext(OpenTokenContext);
}
