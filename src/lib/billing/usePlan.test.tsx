import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";

import { resolveAccess, usePlan } from "@/lib/billing/usePlan";
import { useSession } from "@/lib/auth/useSession";
import { API_URL } from "@/lib/env";
import { makeTestQueryClient } from "@/test/queryWrapper";

vi.mock("@/lib/auth/useSession");

let body: Record<string, unknown> = {};
const server = setupServer(http.get(`${API_URL}/api/v1/billing/me`, () => HttpResponse.json(body)));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>;
}

function setSession(role: string, authenticated = true) {
  vi.mocked(useSession).mockReturnValue({
    profile: { id: "u1", role } as never,
    isAuthenticated: authenticated,
    isLoading: false,
  });
}

describe("resolveAccess (backend sem `access`)", () => {
  it("deriva do plano + cargo da sessão, sem restringir", () => {
    expect(resolveAccess({ plan: "FREE", access: null }, "USER")).toEqual({
      role: "USER",
      restricted: false,
      mentorship: false,
    });
    expect(resolveAccess({ plan: "PRO", access: null }, "USER").mentorship).toBe(true);
    expect(resolveAccess({ plan: "FREE", access: null }, "ELIXIR_ALPHA")).toEqual({
      role: "ELIXIR_ALPHA",
      restricted: false,
      mentorship: true,
    });
    expect(resolveAccess({ plan: "FREE", access: null }, "ADMIN").mentorship).toBe(true);
    expect(resolveAccess({ plan: "FREE", access: null }, "SOMETHING_NEW").role).toBe("USER");
  });

  it("o `access` do servidor sempre vence", () => {
    const access = { role: "ELIXIR_ALPHA" as const, restricted: true, mentorship: true };
    expect(resolveAccess({ plan: "FREE", access }, "USER")).toBe(access);
  });
});

describe("usePlan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expõe plano e acesso da mesma leitura de /billing/me", async () => {
    setSession("ELIXIR_ALPHA");
    body = {
      plan: "FREE",
      billing: null,
      access: { role: "ELIXIR_ALPHA", restricted: true, mentorship: true },
    };
    const { result } = renderHook(() => usePlan(), { wrapper });

    await waitFor(() => expect(result.current.access).toBeDefined());
    expect(result.current.plan).toBe("FREE");
    expect(result.current.isPro).toBe(false);
    expect(result.current.isRestricted).toBe(true);
    expect(result.current.access?.mentorship).toBe(true);
  });

  it("backend antigo (sem `access`): cai no derivado do cargo", async () => {
    setSession("ELIXIR_ALPHA");
    body = { plan: "FREE", billing: null };
    const { result } = renderHook(() => usePlan(), { wrapper });

    await waitFor(() => expect(result.current.access).toBeDefined());
    expect(result.current.isRestricted).toBe(false);
    expect(result.current.access?.mentorship).toBe(true);
  });

  it("deslogado: FREE, sem acesso e sem chamar a API", () => {
    setSession("USER", false);
    const { result } = renderHook(() => usePlan(), { wrapper });
    expect(result.current.plan).toBe("FREE");
    expect(result.current.access).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});
