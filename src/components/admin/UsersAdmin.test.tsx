import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import toast from "react-hot-toast";

import { UsersAdmin } from "./UsersAdmin";
import type {
  AccessInvite,
  AdminUserRow,
  BulkRoleResult,
  CreateInviteInput,
  UserRole,
} from "@/lib/api/access";
import { useSession } from "@/lib/auth/useSession";
import { API_URL } from "@/lib/env";
import { renderWithQuery } from "@/test/queryWrapper";

vi.mock("@/lib/auth/useSession");
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const USERS = `${API_URL}/api/v1/users/admin`;
const INVITES = `${API_URL}/api/v1/access/invites/admin`;

function row(over: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: "u2",
    email: "bruno@example.com",
    firstName: "Bruno",
    lastName: "Lima",
    role: "USER",
    plan: "FREE",
    createdAt: "2026-11-01T12:00:00.000Z",
    lastLoginAt: null,
    ...over,
  };
}

// "Banco" em memória dos handlers do contrato — cada teste começa do zero.
let users: AdminUserRow[] = [];
let invites: AccessInvite[] = [];
const listCalls: URLSearchParams[] = [];
const rolePatches: { id: string; role: UserRole }[] = [];
const bulkCalls: { emails: string[]; role: UserRole }[] = [];
const inviteCreates: CreateInviteInput[] = [];

const server = setupServer(
  http.get(USERS, ({ request }) => {
    const params = new URL(request.url).searchParams;
    listCalls.push(params);
    const search = params.get("search")?.toLowerCase();
    const role = params.get("role");
    const filtered = users.filter(
      (u) =>
        (!search || u.email.includes(search) || u.firstName.toLowerCase().includes(search)) &&
        (!role || u.role === role),
    );
    // Página de 2 para exercitar o "Load more" pelo cursor.
    const start = Number(params.get("cursor") ?? 0);
    const items = filtered.slice(start, start + 2);
    const next = start + 2 < filtered.length ? String(start + 2) : null;
    return HttpResponse.json({ items, nextCursor: next });
  }),
  http.patch(`${USERS}/:id/role`, async ({ request, params }) => {
    const id = String(params.id);
    const { role } = (await request.json()) as { role: UserRole };
    rolePatches.push({ id, role });
    const current = users.find((u) => u.id === id);
    if (!current) return HttpResponse.json({ message: "User not found." }, { status: 404 });
    const next = { ...current, role, plan: role === "ADMIN" ? "PRO" : current.plan } as AdminUserRow;
    users = users.map((u) => (u.id === id ? next : u));
    return HttpResponse.json(next);
  }),
  http.post(`${USERS}/bulk-role`, async ({ request }) => {
    const body = (await request.json()) as { emails: string[]; role: UserRole };
    bulkCalls.push(body);
    const result: BulkRoleResult = { updated: [], unchanged: [], skippedAdmins: [], notFound: [] };
    for (const email of body.emails) {
      const u = users.find((x) => x.email === email);
      if (!u) result.notFound.push(email);
      else if (u.role === "ADMIN") result.skippedAdmins.push(email);
      else if (u.role === body.role) result.unchanged.push(email);
      else result.updated.push(email);
    }
    return HttpResponse.json(result);
  }),
  http.get(INVITES, () => HttpResponse.json(invites)),
  http.post(INVITES, async ({ request }) => {
    const body = (await request.json()) as CreateInviteInput;
    inviteCreates.push(body);
    const created: AccessInvite = {
      id: `i${invites.length + 1}`,
      code: body.code ?? "ELIXIR-RANDOM1",
      role: "ELIXIR_ALPHA",
      maxUses: body.maxUses ?? null,
      usedCount: 0,
      expiresAt: body.expiresAt ?? null,
      active: true,
      note: body.note ?? null,
      createdAt: new Date().toISOString(),
    };
    invites = [created, ...invites];
    return HttpResponse.json(created, { status: 201 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function usersTable() {
  return screen.findByRole("table", { name: "Users" });
}

describe("UsersAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    listCalls.length = 0;
    rolePatches.length = 0;
    bulkCalls.length = 0;
    inviteCreates.length = 0;
    users = [
      row({ id: "u1", email: "admin@deepalpha.fun", firstName: "Root", lastName: "", role: "ADMIN", plan: "PRO", lastLoginAt: "2026-11-20T12:00:00.000Z" }),
      row(),
      row({ id: "u3", email: "carla@example.com", firstName: "Carla", lastName: "Reis", role: "ELIXIR_ALPHA" }),
    ];
    invites = [
      {
        id: "i1",
        code: "ELIXIR-VIP",
        role: "ELIXIR_ALPHA",
        maxUses: null,
        usedCount: 3,
        expiresAt: null,
        active: true,
        note: "Cohort 1",
        createdAt: "2026-11-10T12:00:00.000Z",
      },
    ];
    vi.mocked(useSession).mockReturnValue({
      profile: { id: "u1", email: "admin@deepalpha.fun", role: "ADMIN" } as never,
      isAuthenticated: true,
      isLoading: false,
    });
  });

  it("não-admin vê o aviso e nada é consultado", () => {
    vi.mocked(useSession).mockReturnValue({
      profile: { id: "u9", email: "x@example.com", role: "ELIXIR_ALPHA" } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    renderWithQuery(<UsersAdmin />);
    expect(screen.getByText("This area is admins only.")).toBeInTheDocument();
    expect(listCalls).toHaveLength(0);
  });

  it("lista e-mail, nome, cargo, plano e último login; 'Load more' segue o cursor", async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersAdmin />);

    const table = await usersTable();
    let rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("admin@deepalpha.fun")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Pro")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Bruno Lima")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Never")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("combobox", { name: "Role for bruno@example.com" })).toHaveTextContent("User");
    // O próprio cargo não muda por aqui (o backend recusa com 400).
    expect(within(rows[0]).getByRole("combobox", { name: "Role for admin@deepalpha.fun" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => {
      rows = within(table).getAllByRole("row").slice(1);
      expect(rows).toHaveLength(3);
    });
    expect(listCalls.at(-1)?.get("cursor")).toBe("2");
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("busca (com debounce) e filtro por cargo vão para a API", async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersAdmin />);
    await usersTable();

    await user.type(screen.getByRole("searchbox", { name: "Search" }), "carla");
    await waitFor(() => expect(listCalls.at(-1)?.get("search")).toBe("carla"));
    expect(await screen.findByText("carla@example.com")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("bruno@example.com")).not.toBeInTheDocument());

    await user.click(screen.getByRole("combobox", { name: "Filter by role" }));
    await user.click(await screen.findByRole("option", { name: "Admin" }));
    await waitFor(() => expect(listCalls.at(-1)?.get("role")).toBe("ADMIN"));
    expect(await screen.findByText("No users match these filters.")).toBeInTheDocument();
  });

  it("troca o cargo pela linha (sem confirmação fora do ADMIN)", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    renderWithQuery(<UsersAdmin />);
    await usersTable();

    await user.click(screen.getByRole("combobox", { name: "Role for bruno@example.com" }));
    await user.click(await screen.findByRole("option", { name: "Elixir Alpha" }));

    await waitFor(() => expect(rolePatches).toEqual([{ id: "u2", role: "ELIXIR_ALPHA" }]));
    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Role for bruno@example.com" })).toHaveTextContent(
        "Elixir Alpha",
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("bruno@example.com is now Elixir Alpha.");
  });

  it("dar ADMIN pede confirmação; cancelar não chama a API", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<UsersAdmin />);
    await usersTable();

    await user.click(screen.getByRole("combobox", { name: "Role for bruno@example.com" }));
    await user.click(await screen.findByRole("option", { name: "Admin" }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Make bruno@example.com an admin?"));
    expect(rolePatches).toEqual([]);
    expect(screen.getByRole("combobox", { name: "Role for bruno@example.com" })).toHaveTextContent("User");
  });

  it("lote: normaliza a lista colada, confirma e mostra o resumo", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithQuery(<UsersAdmin />);
    await usersTable();

    await user.click(screen.getByLabelText("Emails"));
    await user.paste(
      "Bruno@Example.com, carla@example.com\nadmin@deepalpha.fun ghost@example.com bruno@example.com",
    );
    expect(screen.getByText("4 emails ready.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply role" }));

    await waitFor(() => expect(bulkCalls).toHaveLength(1));
    expect(bulkCalls[0]).toEqual({
      emails: ["bruno@example.com", "carla@example.com", "admin@deepalpha.fun", "ghost@example.com"],
      role: "ELIXIR_ALPHA",
    });

    const summary = await screen.findByRole("region", { name: "Bulk role result" });
    expect(within(summary).getByText("Updated to Elixir Alpha (1)")).toBeInTheDocument();
    expect(within(summary).getByText("Already had this role (1)")).toBeInTheDocument();
    expect(within(summary).getByText("Skipped (admins) (1)")).toBeInTheDocument();
    expect(within(summary).getByText("No account found (1)")).toBeInTheDocument();
    expect(within(summary).getByText("ghost@example.com")).toBeInTheDocument();
  });

  it("lote: entrada que não é e-mail bloqueia o envio", async () => {
    const user = userEvent.setup();
    renderWithQuery(<UsersAdmin />);
    await usersTable();

    await user.click(screen.getByLabelText("Emails"));
    await user.paste("ok@example.com, not-an-email");
    expect(screen.getByRole("alert")).toHaveTextContent("Fix or remove this entry: not-an-email");
    expect(screen.getByRole("button", { name: "Apply role" })).toBeDisabled();
  });

  it("convites: lista com usos ∞, cria sem código (servidor gera) e copia o link", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderWithQuery(<UsersAdmin />);

    const table = await screen.findByRole("table", { name: "Invites" });
    expect(within(table).getByText("3 / ∞")).toBeInTheDocument();
    expect(within(table).getByText("Cohort 1")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Note (optional)"));
    await user.paste("Cohort 2");
    await user.click(screen.getByRole("button", { name: "Create invite" }));

    await waitFor(() => expect(inviteCreates).toHaveLength(1));
    expect(inviteCreates[0]).toEqual({ maxUses: null, expiresAt: null, note: "Cohort 2" });
    expect(await within(table).findByText("ELIXIR-RANDOM1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy link for ELIXIR-VIP" }));
    expect(writeText).toHaveBeenCalledWith(
      `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/mentorship?invite=ELIXIR-VIP`,
    );
  });
});
