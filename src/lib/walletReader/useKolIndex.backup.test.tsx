import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import toast from "react-hot-toast";

import * as api from "@/lib/api/walletReader";
import { makeTestQueryClient } from "@/test/queryWrapper";
import { KOL_DETAIL_KEY, KOL_INDEX_KEY, useKolIndex } from "./useKolIndex";
import type { KolImportOverride } from "./backup";

vi.mock("@/lib/api/walletReader");
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

function setup() {
  const client = makeTestQueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useKolIndex({}), { wrapper });
  return { result, invalidate };
}

/** Overrides com ~300 KB cada — 12 deles passam do body de 5 MB do servidor. */
const withAvatars = (n: number): KolImportOverride[] =>
  Array.from({ length: n }, (_, i) => ({
    kolId: `k${i}`,
    avatar: `data:image/png;base64,${"A".repeat(300_000)}`,
  }));

describe("useKolIndex — importBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getKolIndex).mockResolvedValue({
      items: [],
      total: 0,
      counts: { byTier: {}, byType: {}, bySquad: {} },
      viewCounts: {},
      squads: [],
    });
    vi.mocked(api.importKolBackup).mockImplementation(async ({ overrides }) => ({
      imported: overrides.length,
    }));
  });

  it("manda um backup grande em lotes sequenciais e soma o total", async () => {
    const { result, invalidate } = setup();
    let res!: { imported: number; failed: boolean };
    await act(async () => {
      res = await result.current.importBackup({ overrides: withAvatars(12) });
    });

    const calls = vi.mocked(api.importKolBackup).mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    for (const [body] of calls) expect(JSON.stringify(body).length).toBeLessThan(5_000_000);
    expect(calls.flatMap(([b]) => b.overrides.map((o) => o.kolId))).toEqual(
      withAvatars(12).map((o) => o.kolId),
    );
    expect(res).toEqual({ imported: 12, failed: false });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KOL_INDEX_KEY });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KOL_DETAIL_KEY });
  });

  it("groups (backup antigo) viaja em todo lote", async () => {
    const { result } = setup();
    const groups = [{ id: "g1", name: "Lair" }];
    await act(async () => {
      await result.current.importBackup({ overrides: withAvatars(12), groups });
    });
    for (const [body] of vi.mocked(api.importKolBackup).mock.calls) {
      expect(body.groups).toEqual(groups);
    }
  });

  it("falha no meio: avisa quantos entraram e ainda atualiza a lista", async () => {
    vi.mocked(api.importKolBackup)
      .mockResolvedValueOnce({ imported: 6 })
      .mockRejectedValueOnce(new Error("boom"));
    const { result, invalidate } = setup();
    let res!: { imported: number; failed: boolean };
    await act(async () => {
      res = await result.current.importBackup({ overrides: withAvatars(12) });
    });

    expect(res).toEqual({ imported: 6, failed: true });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: KOL_INDEX_KEY });
  });

  it("falha no primeiro lote: não invalida nada e avisa", async () => {
    vi.mocked(api.importKolBackup).mockRejectedValueOnce(new Error("400"));
    const { result, invalidate } = setup();
    invalidate.mockClear();
    let res!: { imported: number; failed: boolean };
    await act(async () => {
      res = await result.current.importBackup({ overrides: [{ kolId: "k1", name: "A" }] });
    });
    expect(res).toEqual({ imported: 0, failed: true });
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("expõe `importing` enquanto envia", async () => {
    let release!: () => void;
    vi.mocked(api.importKolBackup).mockImplementationOnce(
      () => new Promise((r) => (release = () => r({ imported: 1 }))),
    );
    const { result } = setup();
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.importBackup({ overrides: [{ kolId: "k1" }] });
    });
    await waitFor(() => expect(result.current.importing).toBe(true));
    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.importing).toBe(false);
  });
});
