import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuditLogsAdmin, draftToFilters } from "./AuditLogsAdmin";
import * as audit from "@/lib/api/audit";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/api/audit", async (importOriginal) => {
  const actual = await importOriginal<typeof audit>();
  return { ...actual, getAuditLogs: vi.fn(), getAuditEntities: vi.fn() };
});

const getLogs = vi.mocked(audit.getAuditLogs);
const getEntities = vi.mocked(audit.getAuditEntities);

function item(over: Partial<audit.AuditLogItem> = {}): audit.AuditLogItem {
  return {
    id: "1",
    createdAt: "2026-09-22T12:00:00.000Z",
    actor: { kind: "user", id: "u1", email: "admin@deepalpha.fun", role: "ADMIN" },
    action: "UPDATE",
    entity: "User",
    entityId: "u2",
    changes: {
      firstName: { old: "Ana", new: "Bia" },
      password: { old: "[redacted]", new: "[redacted]" },
      referredById: { old: null, new: "u9" },
    },
    meta: null,
    path: "/api/v1/users/u2",
    method: "PATCH",
    ip: "189.34.10.2",
    userAgent: "Mozilla/5.0 Test",
    ...over,
  };
}

describe("AuditLogsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEntities.mockResolvedValue(["User", "Subscription"]);
    getLogs.mockResolvedValue({ items: [item()], nextCursor: null });
  });

  it("lista os eventos: quando, quem (com badge ADMIN), ação, alvo e IP", async () => {
    renderWithQuery(<AuditLogsAdmin />);
    expect(await screen.findByText("admin@deepalpha.fun")).toBeInTheDocument();
    expect(screen.getByText("Admin", { selector: "span" })).toBeInTheDocument();
    // Dentro da tabela: o Select do Radix tem um <select> nativo oculto com os mesmos rótulos.
    expect(within(screen.getByRole("table")).getByText("Update")).toBeInTheDocument();
    expect(screen.getByText("User#u2")).toBeInTheDocument();
    expect(screen.getByText("189.34.10.2")).toBeInTheDocument();
  });

  it("ator do sistema e evento de página aparecem legíveis", async () => {
    getLogs.mockResolvedValue({
      items: [
        item({
          id: "2",
          actor: { kind: "system", id: null, email: null, role: null },
          action: "PAGE_VIEW",
          entity: null,
          entityId: null,
          changes: null,
          method: null,
          path: "/radar",
        }),
      ],
      nextCursor: null,
    });
    renderWithQuery(<AuditLogsAdmin />);
    expect(await screen.findByText("system")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Page view")).toBeInTheDocument();
    expect(screen.getByText("/radar")).toBeInTheDocument();
  });

  it("expandir mostra campo: antigo → novo, null como —, e [redacted] destacado", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AuditLogsAdmin />);
    await user.click(await screen.findByRole("button", { name: "Show details" }));

    const firstName = screen.getByText("firstName:").closest("li")!;
    expect(firstName).toHaveTextContent("firstName: Ana→Bia");
    const ref = screen.getByText("referredById:").closest("li")!;
    expect(ref).toHaveTextContent("referredById: —→u9");
    expect(screen.getAllByTitle("Sensitive field — never stored")).toHaveLength(2);
    expect(screen.getByText("Mozilla/5.0 Test")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText("firstName:")).not.toBeInTheDocument();
  });

  it("linhas de operação em lote aparecem nos detalhes", async () => {
    const user = userEvent.setup();
    getLogs.mockResolvedValue({
      items: [
        item({
          action: "UPDATE_MANY",
          entityId: null,
          changes: null,
          meta: {
            count: 2,
            rows: [{ id: "r1", changes: { isActive: { old: true, new: false } } }],
          },
        }),
      ],
      nextCursor: null,
    });
    renderWithQuery(<AuditLogsAdmin />);
    await user.click(await screen.findByRole("button", { name: "Show details" }));
    expect(screen.getByText("#r1")).toBeInTheDocument();
    expect(screen.getByText("isActive:").closest("li")).toHaveTextContent("isActive: true→false");
    expect(screen.getByText("count:").closest("li")).toHaveTextContent("count: 2");
  });

  it("filtros só valem no Apply e viram parâmetros da consulta", async () => {
    const user = userEvent.setup();
    renderWithQuery(<AuditLogsAdmin />);
    await screen.findByText("admin@deepalpha.fun");
    expect(getLogs).toHaveBeenLastCalledWith({}, null);

    await user.type(screen.getByLabelText("User (id or e-mail)"), "bob@x.com");
    await user.type(screen.getByLabelText("Record id"), "u2");
    // Digitar não consulta.
    expect(getLogs).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.click(await screen.findByRole("option", { name: "Login failed" }));
    await user.click(screen.getByRole("combobox", { name: "Entity" }));
    await user.click(await screen.findByRole("option", { name: "Subscription" }));

    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(getLogs).toHaveBeenLastCalledWith(
        { action: "LOGIN_FAILED", actor: "bob@x.com", entity: "Subscription", entityId: "u2" },
        null,
      ),
    );

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith({}, null));
  });

  it("período: dia inteiro no fuso local", () => {
    const f = draftToFilters({
      action: "__all",
      actor: "",
      entity: "__all",
      entityId: "",
      from: "2026-09-01",
      to: "2026-09-22",
    });
    expect(f.from).toBe(new Date("2026-09-01T00:00:00").toISOString());
    expect(f.to).toBe(new Date("2026-09-22T23:59:59.999").toISOString());
    expect(f.action).toBeUndefined();
  });

  it("Load more busca a próxima página pelo cursor e acumula", async () => {
    const user = userEvent.setup();
    getLogs
      .mockResolvedValueOnce({ items: [item({ id: "10", entityId: "a" })], nextCursor: "10" })
      .mockResolvedValueOnce({ items: [item({ id: "9", entityId: "b" })], nextCursor: null });
    renderWithQuery(<AuditLogsAdmin />);

    await screen.findByText("User#a");
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("User#b")).toBeInTheDocument();
    expect(screen.getByText("User#a")).toBeInTheDocument();
    expect(getLogs).toHaveBeenLastCalledWith({}, "10");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("vazio e erro", async () => {
    getLogs.mockResolvedValueOnce({ items: [], nextCursor: null });
    const { unmount } = renderWithQuery(<AuditLogsAdmin />);
    expect(await screen.findByText("No events for these filters.")).toBeInTheDocument();
    unmount();

    // Falha sem status (rede): o componente tenta 1x de novo antes do erro.
    getLogs.mockClear();
    getLogs.mockRejectedValue(new Error("boom"));
    renderWithQuery(<AuditLogsAdmin />);
    expect(await screen.findByRole("alert", {}, { timeout: 4000 })).toHaveTextContent(
      "Could not load the audit log.",
    );
    expect(getLogs).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("403 (sem papel de admin): mostra o erro NA HORA, sem nova tentativa e nunca 'No events'", async () => {
    const { AxiosError } = await import("axios");
    getLogs.mockRejectedValue(
      new AxiosError("Forbidden", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 403,
        data: { message: "Admin access required" },
      } as never),
    );
    renderWithQuery(<AuditLogsAdmin />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Admin access required");
    expect(screen.queryByText("No events for these filters.")).not.toBeInTheDocument();
    expect(getLogs).toHaveBeenCalledTimes(1);
  });
});
