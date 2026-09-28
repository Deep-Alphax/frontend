import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import * as api from "@/lib/api/walletReader";
import type { KolIndexPage, KolIndexParams } from "@/lib/api/walletReader";
import { makeTestQueryClient } from "@/test/queryWrapper";
import { useKolIndex } from "./useKolIndex";

vi.mock("@/lib/api/walletReader");

const page = (total: number, byTier: Record<string, number>): KolIndexPage => ({
  items: [],
  total,
  counts: { byTier, byType: {}, bySquad: {} },
  viewCounts: { all: 275 },
  squads: [],
});

/**
 * Trocar de filtro na rail não pode ZERAR a tela enquanto a nova página chega.
 * Era o bug: cada filtro é uma chave nova do React Query, sem dados até a
 * resposta — e o hook devolvia contagens vazias (tudo 0) e a grade em esqueleto.
 */
describe("useKolIndex — troca de filtro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mantém contagens e total anteriores até o novo resultado chegar", async () => {
    let release!: (p: KolIndexPage) => void;
    vi.mocked(api.getKolIndex)
      .mockResolvedValueOnce(page(275, { wood: 178, gold: 14 }))
      .mockImplementationOnce(() => new Promise((r) => (release = r)));

    const client = makeTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ params }: { params: KolIndexParams }) => useKolIndex(params),
      { wrapper, initialProps: { params: {} } },
    );
    await waitFor(() => expect(result.current.total).toBe(275));

    // Marca "Gold": a nova página fica pendente.
    rerender({ params: { tiers: "gold" } });
    await waitFor(() => expect(api.getKolIndex).toHaveBeenCalledTimes(2));

    expect(result.current.loaded).toBe(true); // sem esqueleto
    expect(result.current.refreshing).toBe(true);
    expect(result.current.total).toBe(275);
    expect(result.current.counts.byTier).toEqual({ wood: 178, gold: 14 });
    expect(result.current.viewCounts).toEqual({ all: 275 });

    await act(async () => release(page(14, { wood: 178, gold: 14 })));
    await waitFor(() => expect(result.current.total).toBe(14));
    expect(result.current.refreshing).toBe(false);
  });
});
